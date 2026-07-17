/* ============================================================
   ИГРА: персонал — найм, обучение, настроение, усталость, опыт
   ============================================================ */
'use strict';

AST.staffM = (() => {

  const N = () => AST.data.names;

  function staffCap() {
    let cap = AST.BAL.STAFF_BASE;
    for (const id in AST.state.research.done) {
      const r = AST.data.researchById[id];
      if (r && r.sp === 'staff2') cap += 2;
    }
    return cap;
  }

  const canHire = () => AST.state.staff.length < staffCap();

  /** Роли, доступные для найма (по построенным зданиям) */
  function unlockedRoles() {
    const S = AST.state;
    const out = [];
    for (const roleId in AST.data.roles) {
      const r = AST.data.roles[roleId];
      if (!r.unlock) { out.push(roleId); continue; }
      const facId = r.unlock.replace('fac_', '');
      if ((S.garage.fac[facId] || 0) > 0) out.push(roleId);
    }
    return out;
  }

  /** Генерация кандидата */
  function genApplicant(role) {
    const S = AST.state;
    role = role || 'mechanic';
    const female = role === 'admin' || role === 'accountant' ? AST.u.chance(0.6) : AST.u.chance(0.12);
    const first = AST.u.pick(female ? N().female : N().male);
    let last = AST.u.pick(N().last);
    if (female) last += 'а';
    const hireQ = AST.mods().hireQ;
    const skill = AST.u.clamp(Math.round(AST.u.rf(1, 2.6) + S.rep / 35 + hireQ * 5 + AST.u.rf(0, 1.5)), 1, 7);
    const traits = [];
    if (AST.u.chance(0.35)) traits.push(AST.u.pick(N().traits || AST.data.traits).id);
    if (AST.u.chance(0.1)) {
      const t2 = AST.u.pick(AST.data.traits).id;
      if (!traits.includes(t2)) traits.push(t2);
    }
    const base = AST.data.roles[role].base;
    let salary = base * (0.7 + skill * 0.16) * AST.u.rf(0.9, 1.12) * S.inflation;
    if (traits.includes('greedy')) salary *= 1.15;
    const spec = (role === 'mechanic' && skill >= 3 && AST.u.chance(0.4))
      ? AST.u.pick(AST.data.specs.filter((s) => s.id)).id : null;

    return {
      id: AST.u.uid(),
      name: first + ' ' + last,
      emoji: role === 'mechanic' ? AST.u.pick(N().mechEmoji) : AST.u.pick(N().clientEmoji),
      age: AST.u.ri(19, 58),
      role, spec,
      lvl: 1, xp: 0,
      skill,
      speed: +AST.u.rf(0.85, 1.1).toFixed(2),
      quality: +AST.u.rf(0.8, 1.1).toFixed(2),
      mood: 70, fatigue: 0,
      salary: Math.round(salary),
      traits,
      hiredDay: 0, vacationUntil: 0, training: null,
      stats: { earned: 0, repairs: 0, fivestars: 0 },
    };
  }

  /** Обновить список кандидатов (раз в день) */
  function refreshApplicants(force = false) {
    const S = AST.state;
    if (!force && S.applicantsDay === S.time.day && S.applicants.length) return;
    S.applicantsDay = S.time.day;
    const roles = unlockedRoles();
    const list = [];
    const n = AST.u.ri(3, 5);
    for (let i = 0; i < n; i++) {
      // механики чаще
      const role = AST.u.chance(0.55) ? 'mechanic' : AST.u.pick(roles);
      list.push(genApplicant(role));
    }
    S.applicants = list;
  }

  function hire(appId) {
    const S = AST.state;
    const app = S.applicants.find((a) => a.id === appId);
    if (!app) return false;
    if (!canHire()) {
      AST.ui.toast('👥', 'Штат заполнен', 'Исследуйте «Расширение штата» в ветке Персонал', 'err');
      return false;
    }
    const fee = Math.round(app.salary * 1.5);
    if (!AST.econ.trySpend(fee, 'staff', 'Оформление сотрудника')) return false;
    app.hiredDay = S.time.day;
    S.staff.push(app);
    S.applicants = S.applicants.filter((a) => a.id !== appId);
    AST.addC('hires');
    AST._modsDirty = true;
    AST.audio.play('buy');
    AST.ui.toast('🤝', `${app.name} в команде!`, AST.data.roles[app.role].name, 'ok');
    AST.ui.dirty('staff'); AST.ui.dirty('garage');
    return true;
  }

  /** Легенда из события: сильный и недорогой */
  function hireVeteran() {
    const S = AST.state;
    const vet = genApplicant('mechanic');
    vet.name = AST.u.pick(N().male) + ' ' + AST.u.pick(N().last);
    vet.age = AST.u.ri(58, 67);
    vet.emoji = '🧙';
    vet.skill = AST.u.ri(7, 9);
    vet.quality = 1.15;
    vet.speed = 0.95;
    vet.salary = Math.round(AST.data.roles.mechanic.base * 1.6 * S.inflation);
    vet.traits = ['golden'];
    vet.hiredDay = S.time.day;
    S.staff.push(vet);
    AST.addC('hires');
    AST._modsDirty = true;
    AST.ui.dirty('staff');
    return vet;
  }

  function fire(staffId) {
    const S = AST.state;
    const st = S.staff.find((s) => s.id === staffId);
    if (!st) return false;
    // выходное пособие
    AST.econ.pay(Math.round(st.salary * 3), 'staff', 'Выходное пособие');
    // освободить работу
    const job = S.jobs.find((j) => j.mechId === staffId);
    if (job) job.mechId = null;
    S.staff = S.staff.filter((s) => s.id !== staffId);
    AST.addC('fires');
    moodAll(-5);
    AST._modsDirty = true;
    AST.ui.dirty('staff'); AST.ui.dirty('garage');
    return true;
  }

  function trainCost(st) {
    return Math.round(160 * Math.pow(st.skill, 1.55) * (1 - AST.mods().trainCost) * AST.state.inflation);
  }

  function train(staffId) {
    const S = AST.state;
    const st = S.staff.find((s) => s.id === staffId);
    if (!st || st.training || st.vacationUntil) return false;
    if (st.skill >= 10) { AST.ui.toast('🎓', 'Максимальный навык', `${st.name} уже мастер 10/10`, 'warn'); return false; }
    const cost = trainCost(st);
    if (!AST.econ.trySpend(cost, 'staff', 'Курсы повышения квалификации')) return false;
    const job = S.jobs.find((j) => j.mechId === staffId);
    if (job) job.mechId = null;                      // ушёл с поста на учёбу
    st.training = { untilDay: S.time.day + 1 };
    AST._modsDirty = true;
    AST.ui.toast('🎓', `${st.name} на курсах`, 'Вернётся завтра с +1 к навыку', 'ok');
    AST.ui.dirty('staff');
    return true;
  }

  function vacation(staffId) {
    const S = AST.state;
    const st = S.staff.find((s) => s.id === staffId);
    if (!st || st.training || st.vacationUntil) return false;
    if (!AST.econ.trySpend(Math.round(st.salary * 2), 'staff', 'Отпускные')) return false;
    const job = S.jobs.find((j) => j.mechId === staffId);
    if (job) job.mechId = null;
    st.vacationUntil = S.time.day + 3;
    AST._modsDirty = true;
    AST.ui.toast('🏖️', `${st.name} в отпуске`, 'Вернётся через 3 дня отдохнувшим', 'ok');
    AST.ui.dirty('staff');
    return true;
  }

  function raise(staffId) {
    const st = AST.state.staff.find((s) => s.id === staffId);
    if (!st) return false;
    st.salary = Math.round(st.salary * 1.15);
    st.mood = Math.min(100, st.mood + 18);
    AST.ui.toast('💵', `Зарплата ${st.name} повышена`, `Теперь ${AST.u.fmt(st.salary)}/день`, 'ok');
    AST.ui.dirty('staff');
    return true;
  }

  function moodAll(delta) {
    AST.state.staff.forEach((s) => { s.mood = AST.u.clamp(s.mood + delta, 0, 100); });
  }

  /** Черта сотрудника по id */
  const trait = (st, tid) => st.traits.includes(tid);

  function traitVal(st, key) {
    let v = 0;
    for (const tid of st.traits) {
      const t = AST.data.traits.find((x) => x.id === tid);
      if (t && t[key]) v += t[key];
    }
    return v;
  }

  /** Эффективная скорость механика */
  function effSpeed(st) {
    let v = st.speed * (1 + traitVal(st, 'speed'));
    if (st.fatigue > 70) v *= 1 - Math.min(0.35, (st.fatigue - 70) / 100);
    if (st.mood >= 80) v *= 1.08;
    else if (st.mood < 30) v *= 0.85;
    return v;
  }

  /** Шанс ошибки на конкретной работе */
  function errChance(st, fault) {
    let p = fault.errBase;
    p += Math.max(0, (fault.minSkill - st.skill) * 0.035);   // не дорос до сложности
    if (st.fatigue > 80) p += 0.05;
    p *= (1 + traitVal(st, 'err'));
    p *= Math.max(0.3, 2 - st.quality);                       // качественный мастер ошибается реже
    p *= (1 - AST.mods().errReduce);
    return AST.u.clamp(p, 0.004, 0.6);
  }

  /** Начислить опыт механику */
  function xpGain(st, xp) {
    const S = AST.state;
    let mult = 1 + AST.mods().xp;
    if (S.staff.some((x) => x.id !== st.id && trait(x, 'mentor'))) mult += 0.15;
    st.xp += xp * mult;
    let need = 40 * Math.pow(st.lvl, 1.5);
    while (st.xp >= need) {
      st.xp -= need;
      st.lvl++;
      st.skill = Math.min(10, +(st.skill + 0.4).toFixed(1));
      st.speed = +(st.speed + 0.02).toFixed(2);
      AST.ui.toast('⬆️', `${st.name} — уровень ${st.lvl}!`, `Навык: ${st.skill}/10`, 'ok');
      AST.audio.play('level');
      need = 40 * Math.pow(st.lvl, 1.5);
    }
  }

  /** Свободные механики (для назначения на работу) */
  function freeMechanics() {
    const S = AST.state;
    const busy = new Set(S.jobs.map((j) => j.mechId).filter(Boolean));
    return S.staff.filter((s) =>
      s.role === 'mechanic' && !busy.has(s.id) && !s.vacationUntil && !s.training && s.fatigue < 96
    );
  }

  /** Часовой тик: отдых и настроение простаивающих */
  function hourly() {
    const S = AST.state;
    const busy = new Set(S.jobs.map((j) => j.mechId).filter(Boolean));
    const baseline = 60 + AST.mods().mood;
    for (const st of S.staff) {
      if (!busy.has(st.id)) st.fatigue = Math.max(0, st.fatigue - 2);
      // настроение плывёт к базовому
      const target = AST.u.clamp(baseline + traitVal(st, 'mood'), 0, 100);
      st.mood += AST.u.clamp(target - st.mood, -0.6, 0.6);
    }
  }

  /** Новый день: сон, отпуска, курсы, риск увольнения */
  function newDay() {
    const S = AST.state;
    for (const st of S.staff) {
      st.fatigue = Math.max(0, st.fatigue - 55);
      if (st.vacationUntil && S.time.day >= st.vacationUntil) {
        st.vacationUntil = 0;
        st.fatigue = 0;
        st.mood = Math.min(100, st.mood + 25);
        AST.ui.toast('🏖️', `${st.name} вернулся из отпуска`, 'Полон сил!', 'ok');
      }
      if (st.training && S.time.day >= st.training.untilDay) {
        st.training = null;
        st.skill = Math.min(10, +(st.skill + 1).toFixed(1));
        st.quality = +(st.quality + 0.03).toFixed(2);
        AST.addC('trains');
        AST.ui.toast('🎓', `${st.name} окончил курсы`, `Навык: ${st.skill}/10`, 'gold');
      }
      // недовольство зарплатой
      const market = AST.data.roles[st.role].base * (0.7 + st.skill * 0.16) * S.inflation;
      if (st.salary < market * 0.85) st.mood = Math.max(0, st.mood - 4);
    }
    // увольнения по собственному
    const quitters = S.staff.filter((st) => st.mood <= 12 && !trait(st, 'loyal') && AST.u.chance(0.3));
    for (const q of quitters) {
      const job = S.jobs.find((j) => j.mechId === q.id);
      if (job) job.mechId = null;
      S.staff = S.staff.filter((s) => s.id !== q.id);
      AST.ui.toast('🚪', `${q.name} уволился!`, 'Настроение было на нуле…', 'err');
    }
    if (quitters.length) { AST._modsDirty = true; AST.ui.dirty('staff'); }
    refreshApplicants(true);
  }

  return {
    staffCap, canHire, unlockedRoles, genApplicant, refreshApplicants,
    hire, hireVeteran, fire, train, trainCost, vacation, raise, moodAll,
    trait, traitVal, effSpeed, errChance, xpGain, freeMechanics, hourly, newDay,
  };
})();
