/* ============================================================
   ИГРА: конвейер ремонта.
   Очередь → бокс+механик → диагностика → ремонт по неисправностям
   (с деталями со склада и ошибками) → оплата → отзыв.
   Если детали нет — работа ждёт до 2 часов, потом пропускается:
   клиент платит только за сделанное.
   ============================================================ */
'use strict';

AST.repair = (() => {

  const WAIT_SKIP_MIN = 45;    // сколько ждём деталь, прежде чем пропустить работу
  const COURIER_MIN = 35;      // срочная доставка детали «курьером»
  const COURIER_MARKUP = 1.6;  // наценка срочной закупки (съедает маржу)

  /* Совпадение специализации механика с категорией работ */
  const SPEC_MATCH = {
    engine: ['engine', 'cooling', 'fuel', 'exhaust', 'to'],
    trans: ['trans'],
    susp: ['susp', 'tires'],
    electric: ['electric', 'climate'],
    brakes: ['brakes'],
    body: ['body'],
    ev: ['ev'],
  };

  const faultOf = (jf) => AST.data.faultById[jf.fid];

  /** Назначение: свободный бокс + свободный механик + первый в очереди */
  function assign() {
    const S = AST.state;
    // самовосстановление: бокс не должен числиться занятым несуществующим заказом
    for (const bay of S.garage.bays) {
      if (bay.jobId && !S.jobs.some((j) => j.id === bay.jobId)) bay.jobId = null;
    }
    while (true) {
      if (!S.queue.length) return;
      const bay = S.garage.bays.find((b) => !b.jobId && b.brokenUntil <= S.time.abs);
      if (!bay) return;
      const mechs = AST.staffM.freeMechanics();
      if (!mechs.length) return;
      const client = S.queue.shift();
      // лучший механик под сложность машины
      const car = AST.data.carById[client.carId];
      mechs.sort((a, b) => b.skill - a.skill);
      const mech = car.complexity >= 4 ? mechs[0] : mechs[mechs.length - 1];

      const m = AST.mods();
      const diagDur = Math.max(6, AST.BAL.DIAG_BASE_MIN * (1 + car.complexity * 0.3) / (1 + m.diag));
      const job = {
        id: AST.u.uid(),
        client, bayId: bay.id, mechId: mech.id,
        phase: 'diag',
        progress: 0, total: diagDur,
        faultIdx: -1,
        doneIdx: [], skipIdx: [],
        errors: 0,
        partsCost: 0,
        waiting: null,       // {pid} — ждём деталь
        waitedPartMin: 0,
        erroredThis: false,
        notifiedMissing: false,
      };
      bay.jobId = job.id;
      S.jobs.push(job);
      client.state = 'work';
      AST.scene && AST.scene.carToBay(client, bay.id);
      AST.ui.dirty('garage');
    }
  }

  /** Скорость работы над текущей неисправностью (множитель) */
  function workSpeed(job, mech, fault) {
    const S = AST.state;
    const m = AST.mods();
    if (m.blackout > 0) return 0;                                   // нет электричества
    const bay = S.garage.bays.find((b) => b.id === job.bayId);
    if (!bay || bay.brokenUntil > S.time.abs) return 0;             // подъёмник сломан
    let v = AST.staffM.effSpeed(mech) * (1 + m.speed);
    v *= AST.BAL.LIFT_TIER_SPEED[(bay.tier || 1) - 1] || 1;
    if (mech.spec && (SPEC_MATCH[mech.spec] || []).includes(fault.cat)) v *= 1.3;
    if (fault.cat === 'ev') {
      v *= 1 + m.evSpeed;
      if (mech.spec === 'ev') v *= 1.2;
    }
    return v;
  }

  /** Выбрать следующую неисправность: сперва те, на которые есть детали */
  function pickNext(job) {
    const c = job.client;
    const remaining = [];
    c.faults.forEach((jf, i) => {
      if (jf.hidden) return;
      if (job.doneIdx.includes(i) || job.skipIdx.includes(i)) return;
      remaining.push(i);
    });
    if (!remaining.length) return -1;
    const ready = remaining.find((i) =>
      faultOf(c.faults[i]).parts.every((pid) => AST.inv.qty(pid) > 0));
    return ready != null ? ready : remaining[0];
  }

  /** Начать работу над следующей неисправностью (или завершить заказ) */
  function nextFault(job) {
    const idx = pickNext(job);
    if (idx === -1) { finish(job); return; }
    const fault = faultOf(job.client.faults[idx]);
    job.faultIdx = idx;
    job.phase = 'repair';
    job.progress = 0;
    job.total = fault.dur;
    job.erroredThis = false;
    job.waiting = null;
    job.waitedPartMin = 0;
    tryTakeParts(job, fault);
  }

  function tryTakeParts(job, fault) {
    const S = AST.state;
    const missing = fault.parts.filter((pid) => AST.inv.qty(pid) <= 0);

    if (missing.length) {
      // 1) склад пополнился автозаказом? 2) срочный курьер за деньги 3) ждём и скипаем
      AST.inv.autoReorder(missing[0], 1);
      const cost = Math.round(missing.reduce((a, pid) =>
        a + AST.data.partById[pid].price, 0) * S.inflation * COURIER_MARKUP);
      if (S.money >= cost) {
        AST.econ.pay(cost, 'parts', 'Срочная доставка детали');
        // срочные детали — тоже куплены и израсходованы (счётчики миссий)
        AST.addC('partsBought', missing.length);
        AST.addC('partsUsed', missing.length);
        // статистика расхода — для рекомендаций закупок
        for (const pid of fault.parts) S.partUse[pid] = (S.partUse[pid] || 0) + 1;
        // имеющиеся детали берём со склада сразу
        for (const pid of fault.parts) {
          if (!missing.includes(pid) && AST.inv.take(pid, 1)) {
            job.partsCost += AST.data.partById[pid].price * S.inflation;
          }
        }
        // клиенту детали пойдут в счёт по обычной цене — наценка съедает маржу
        for (const pid of missing) job.partsCost += AST.data.partById[pid].price * S.inflation;
        job.waiting = { courier: true, pids: missing, etaMin: COURIER_MIN };
        if (!job.notifiedMissing) {
          job.notifiedMissing = true;
          const p = AST.data.partById[missing[0]];
          AST.ui.toast('🛵', 'Срочная доставка', `«${p.name}» не было на складе — курьер везёт с наценкой (−${AST.u.fmt(cost)})`, 'warn');
        }
      } else {
        job.waiting = { pid: missing[0] };
        if (!job.notifiedMissing) {
          job.notifiedMissing = true;
          const p = AST.data.partById[missing[0]];
          AST.ui.toast('📦', 'Не хватает детали!', `«${p.name}» — закажите на Складе, иначе работа будет пропущена`, 'warn');
        }
      }
      AST.ui.dirty('garage');
      return false;
    }
    // всё есть — списываем со склада
    for (const pid of fault.parts) {
      AST.inv.take(pid, 1);
      S.partUse[pid] = (S.partUse[pid] || 0) + 1;
      const p = AST.data.partById[pid];
      job.partsCost += p.price * S.inflation;
    }
    job.waiting = null;
    job.waitedPartMin = 0;
    return true;
  }

  /** Прогресс всех работ (только в рабочие часы — ночью сервис спит) */
  function tick(dtMin) {
    const S = AST.state;
    if (!AST.time.isOpen()) return;
    assign();
    if (!S.jobs.length) return;

    for (const job of S.jobs.slice()) {
      const client = job.client;
      const mech = S.staff.find((s) => s.id === job.mechId);

      // механик пропал (уволен/учёба) — ждём замену
      if (!mech) {
        const free = AST.staffM.freeMechanics();
        if (free.length) { job.mechId = free[0].id; }
        continue;
      }

      if (job.phase === 'diag') {
        const m = AST.mods();
        if (m.blackout > 0) continue;
        job.progress += dtMin * AST.staffM.effSpeed(mech);
        if (job.progress >= job.total) {
          // скрытые неисправности раскрываются
          const hidden = client.faults.filter((f) => f.hidden);
          if (hidden.length) {
            hidden.forEach((f) => { f.hidden = false; });
            AST.ui.toast('🔎', 'Найдена скрытая неисправность!', 'Диагностика окупается — чек будет больше', 'ok');
          }
          nextFault(job);
        }
        continue;
      }

      // ремонт
      const jf = client.faults[job.faultIdx];
      const fault = jf && faultOf(jf);
      if (!fault) { nextFault(job); continue; }

      // ждём деталь
      if (job.waiting) {
        if (job.waiting.courier) {
          // курьер уже в пути — детали оплачены
          job.waiting.etaMin -= dtMin;
          if (job.waiting.etaMin > 0) continue;
          job.waiting = null;
          job.waitedPartMin = 0;
        } else {
          job.waitedPartMin += dtMin;
          if (!tryTakeParts(job, fault)) {
            if (job.waitedPartMin > WAIT_SKIP_MIN) {
              // пропускаем эту работу и берём следующую
              job.skipIdx.push(job.faultIdx);
              nextFault(job);
            }
            continue;
          }
        }
      }

      const v = workSpeed(job, mech, fault);
      if (v <= 0) continue;
      job.progress += dtMin * v;
      // усталость: ~7 очков за час работы
      mech.fatigue = AST.u.clamp(
        mech.fatigue + (dtMin / 60) * 7 * (1 - AST.mods().fatigueReduce + AST.staffM.traitVal(mech, 'fatigue')),
        0, 100
      );

      if (job.progress >= job.total) {
        // шанс ошибки — работа затягивается
        if (!job.erroredThis && AST.u.chance(AST.staffM.errChance(mech, fault))) {
          job.erroredThis = true;
          job.errors++;
          AST.addC('errors');
          job.total += fault.dur * 0.45;
          AST.scene && AST.scene.bayAlert(job.bayId);
          continue;
        }
        // неисправность устранена
        job.doneIdx.push(job.faultIdx);
        AST.addC('cat_' + fault.cat);
        AST.staffM.xpGain(mech, fault.xp);
        AST.audio.play('wrench');
        nextFault(job);
      }
    }
  }

  /** Завершение заказа: клиент платит за сделанное */
  function finish(job) {
    const S = AST.state;
    const client = job.client;
    const car = AST.data.carById[client.carId];
    const cls = AST.data.carClasses[car.cls];
    const mech = S.staff.find((s) => s.id === job.mechId);
    const m = AST.mods();
    const pers = AST.clients.persOf(client);
    const doneCount = job.doneIdx.length;
    const skipped = job.skipIdx.length;

    // счёт: работы + детали с наценкой (+ диагностика всегда)
    let labor = 15 * car.complexity;
    for (const i of job.doneIdx) labor += faultOf(client.faults[i]).labor;
    labor *= cls.mult * S.inflation;
    const partsRetail = job.partsCost * AST.BAL.PARTS_MARKUP;
    let bill = (labor + partsRetail) * (1 + m.income);
    if (client.vip) bill *= 1.8;
    if (client.regular) bill *= 0.95;          // скидка постоянного клиента
    bill = Math.round(bill);

    if (client.contract) {
      // контрактные машины оплачиваются пакетом — не по счёту
      bill = 0;
      AST.contracts.carDone();
    } else {
      AST.econ.earn(bill, 'repair', 'Ремонт');
    }

    // чаевые — только если всё починили (постоянники щедрее)
    const tipChance = AST.BAL.TIP_CHANCE + m.tips + (client.regular ? 0.12 : 0);
    if (bill > 0 && doneCount > 0 && skipped === 0 && AST.u.chance(tipChance)) {
      const tip = Math.round(bill * AST.u.rf(0.05, 0.15) * pers.tip);
      if (tip > 0) { AST.econ.earn(tip, 'tips', 'Чаевые'); AST.addC('tips'); }
    }

    // личная статистика механика + вклад в сводку дня
    if (mech) {
      mech.stats = mech.stats || { earned: 0, repairs: 0, fivestars: 0 };
      mech.stats.earned += bill;
      mech.stats.repairs++;
      S.dayMech[mech.id] = (S.dayMech[mech.id] || 0) + bill;
    }

    // счётчики
    if (doneCount > 0) AST.addC('repairs');
    AST.addC('clients');
    AST.addC('cls_' + car.cls);
    if (client.vip) AST.addC('vip');

    // оценка клиента: хорошая работа без ошибок и долгого ожидания = 4–5★
    const qualityBase = (mech ? mech.quality + AST.staffM.traitVal(mech, 'quality') : 1) + m.quality;
    let score = 3.9 + (qualityBase - 1.0) * 3;
    score -= job.errors * 1.3 * pers.strict;
    score -= skipped * 0.9 * pers.strict;                 // не всё смогли починить
    if (doneCount === 0) score = Math.min(score, 2);      // вообще ничем не помогли
    const waitFactor = client.waitedMin / Math.max(1, client.patience);
    if (waitFactor > 0.85) score -= 1.4 * pers.strict;
    else if (waitFactor > 0.55) score -= 0.5 * pers.strict;
    score += AST.u.rf(-0.3, 0.7);
    const final = client.contract ? AST.u.clamp(Math.round(score), 1, 5)
                                  : AST.clients.pushReview(score, client.name);
    if (final === 5) {
      AST.addC('perfect');
      if (mech && mech.stats) mech.stats.fivestars++;
    }

    // лояльность: довольный клиент может стать постоянным
    AST.clients.loyaltyAfterVisit(client, final);

    // опыт владельца и очки науки
    let xpSum = 0;
    for (const i of job.doneIdx) xpSum += faultOf(client.faults[i]).xp;
    if (xpSum > 0) {
      AST.ownerXpAdd(xpSum * 0.6);
      AST.research.addRp(1 + (car.complexity >= 4 ? 1 : 0));
    }

    if (skipped > 0) {
      AST.ui.toast('😕', `${client.name} уехал не до конца довольным`, `Пропущено работ из-за нехватки деталей: ${skipped}`, 'warn');
    }

    AST.audio.play('cash');
    AST.scene && AST.scene.cashAt(job.bayId, bill);
    release(job);
    AST.scene && AST.scene.carLeft(client, false);
    AST.ui.dirty('garage');
    AST.ui.dirty('finance');
  }

  function release(job) {
    const S = AST.state;
    const bay = S.garage.bays.find((b) => b.id === job.bayId);
    if (bay && bay.jobId === job.id) bay.jobId = null;
    S.jobs = S.jobs.filter((j) => j.id !== job.id);
  }

  /** Заказ по id бокса (для UI/сцены) */
  function jobAtBay(bayId) {
    return AST.state.jobs.find((j) => j.bayId === bayId) || null;
  }

  return { tick, assign, jobAtBay, SPEC_MATCH };
})();
