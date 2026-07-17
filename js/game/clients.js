/* ============================================================
   ИГРА: клиенты — поток, генерация машин и поломок,
   очередь, терпение, отзывы, репутация
   ============================================================ */
'use strict';

AST.clients = (() => {
  let spawnAccum = 0;   // накопитель вероятности появления

  const queueCap = () => AST.BAL.QUEUE_BASE + AST.mods().queueCap;

  /** Поток клиентов в час */
  function ratePerHour() {
    const S = AST.state;
    let rate = 0.45 + (S.rep / 100) * 3.5;
    rate *= 1 + AST.mods().clients;
    rate *= AST.time.weatherMult();
    rate *= AST.time.seasonClientMult();
    return Math.max(0.1, rate);
  }

  /** Доступные классы машин по репутации (+ электро по исследованию) */
  function availableClasses() {
    const S = AST.state;
    return Object.keys(AST.data.carClasses).filter((cls) => {
      const c = AST.data.carClasses[cls];
      if (S.rep < c.rep) return false;
      if (cls === 'ev' && !AST.research.hasSp('ev')) return false;
      return true;
    });
  }

  /** Подбор неисправностей для машины */
  function genFaults(car, wear, forceMany = false) {
    const S = AST.state;
    const isEv = car.tags.includes('ev');
    let pool = AST.data.faults.filter((f) => {
      if (f.tag && !car.tags.includes(f.tag)) return false;
      if (isEv && !AST.data.evCats.includes(f.cat) && !['cabin_filter_r', 'brake_fluid_r'].includes(f.id)) return false;
      if (!isEv && f.cat === 'ev') return false;
      return true;
    });
    // первые дни — щадящий режим: только работы, на которые есть детали
    if (S.time.day <= 2 && !forceMany) {
      const easy = pool.filter((f) => f.diff <= 2 &&
        f.parts.every((pid) => (S.inv[pid] || 0) > 0));
      if (easy.length >= 3) pool = easy;
    }
    let count = 1 + Math.floor(wear * 2.2 + AST.u.rf(0, 1.3));
    if (forceMany) count = AST.u.ri(3, 4);
    count = AST.u.clamp(count, 1, 4);
    const chosen = [];
    const used = new Set();
    let guard = 60;
    while (chosen.length < count && guard-- > 0) {
      const f = AST.u.pickW(pool, (x) => x.weight * (x.diff <= 2 ? 1 : wear + 0.35));
      if (used.has(f.id)) continue;
      used.add(f.id);
      chosen.push({ fid: f.id, hidden: false });
    }
    // скрытая неисправность (найдёт диагностика)
    if (AST.research.hasSp('hidden') && AST.u.chance(0.28)) {
      const f = AST.u.pickW(pool, (x) => x.weight);
      if (!used.has(f.id)) chosen.push({ fid: f.id, hidden: true });
    }
    return chosen;
  }

  /** Создать клиента */
  function makeClient(forceCls = null, forceMany = false) {
    const S = AST.state;
    const classes = availableClasses();
    const cls = forceCls || AST.u.pickW(classes, (c) => AST.data.carClasses[c].weight);
    const carPool = AST.data.cars.filter((c) => c.cls === cls);
    const car = AST.u.pick(carPool);
    const mileage = AST.u.ri(15, 280) * 1000;
    const wear = AST.u.clamp(mileage / 300000 + AST.u.rf(-0.08, 0.2), 0.05, 1);
    const female = AST.u.chance(0.35);
    const pers = AST.u.pick(AST.data.personalities);
    const isVip = AST.research.hasSp('vip') && ['biz', 'prem', 'sport', 'rare'].includes(cls) && AST.u.chance(0.25);
    const basePatience = AST.u.rf(75, 135);

    return {
      id: AST.u.uid(),
      name: AST.u.pick(female ? AST.data.names.female : AST.data.names.male),
      emoji: AST.u.pick(AST.data.names.clientEmoji),
      pers: pers.id,
      vip: isVip,
      carId: car.id,
      color: AST.u.pick(AST.data.carColors),
      mileage, wear,
      faults: genFaults(car, wear, forceMany),
      patience: basePatience * pers.patience * (1 + AST.mods().patience) * (isVip ? 0.7 : 1),
      waitedMin: 0,
      arrivedAbs: S.time.abs,
      state: 'queue',
    };
  }

  /** Появление клиента (в очередь). Иногда возвращается постоянный */
  function spawn(forceCls = null, forceMany = false) {
    const S = AST.state;
    if (S.queue.length >= queueCap()) return null;
    const c = makeClient(forceCls, forceMany);

    // постоянный клиент возвращается со своей машиной
    if (!forceCls && S.regulars.length && AST.u.chance(0.25)) {
      const reg = AST.u.pick(S.regulars);
      const regCar = AST.data.carById[reg.carId];
      if (regCar && S.rep >= AST.data.carClasses[regCar.cls].rep - 10) {
        c.name = reg.name;
        c.emoji = reg.emoji;
        c.carId = reg.carId;
        c.color = reg.color;
        c.faults = genFaults(regCar, AST.u.clamp(c.wear, 0.1, 1));
        c.regular = true;
        c.patience *= 1.3;       // постоянные доверяют и ждут дольше
      }
    }

    S.queue.push(c);
    AST.audio.play('car_in');
    AST.scene && AST.scene.carArrived(c);
    AST.ui.dirty('garage');
    return c;
  }

  /** После визита: лояльность растёт или рушится */
  function loyaltyAfterVisit(client, score) {
    const S = AST.state;
    if (client.contract) return;
    if (client.regular) {
      const reg = S.regulars.find((r) => r.name === client.name && r.carId === client.carId);
      if (reg) {
        if (score <= 2) {
          // постоянный клиент разочарован — уходит навсегда
          S.regulars = S.regulars.filter((r) => r !== reg);
          AST.ui.toast('💔', `${reg.name} больше не приедет`, 'Постоянный клиент разочарован качеством', 'err');
        } else {
          reg.visits++;
          AST.addC('regularVisits');
        }
      }
      return;
    }
    // новый довольный клиент может стать постоянным
    if (score >= 4 && S.regulars.length < 24 && AST.u.chance(0.35)) {
      S.regulars.push({ name: client.name, emoji: client.emoji, carId: client.carId, color: client.color, visits: 1 });
      AST.ui.toast('⭐', `${client.name} теперь ваш постоянный клиент!`, 'Будет возвращаться — не подводите', 'ok');
    }
  }

  /** Спец-клиент из события */
  function spawnSpecial(cls) {
    const c = spawn(cls, true);
    if (c) { c.patience *= 2; }
    return c;
  }

  /** Всплеск клиентов */
  function burst(n) {
    for (let i = 0; i < n; i++) setTimeout(() => spawn(), i * 600);
  }

  /** Отзыв + влияние на репутацию */
  function pushReview(score, name) {
    const S = AST.state;
    score = AST.u.clamp(Math.round(score), 1, 5);
    const texts = AST.data.reviews[score];
    S.reviews.unshift({ score, name, text: AST.u.pick(texts), day: S.time.day });
    if (S.reviews.length > 40) S.reviews.pop();
    if (score === 5) AST.addC('reviews5');
    if (score === 1) AST.addC('reviews1');
    AST.rep((score - 3) * 0.35);
    return score;
  }

  /** Тик: спавн + терпение очереди. Ночью клиенты «спят» — терпение заморожено */
  function tick(dtMin) {
    const S = AST.state;
    if (!AST.time.isOpen()) return;

    // спавн (аккумулятор с лёгкой случайностью)
    spawnAccum += (ratePerHour() / 60) * dtMin * AST.u.rf(0.6, 1.4);
    while (spawnAccum >= 1) {
      spawnAccum -= 1;
      spawn();
    }

    // терпение в очереди
    const leaving = [];
    for (const c of S.queue) {
      c.waitedMin += dtMin;
      if (c.waitedMin > c.patience) leaving.push(c);
    }
    for (const c of leaving) {
      S.queue = S.queue.filter((x) => x.id !== c.id);
      AST.addC('lost');
      AST.rep(-0.6);
      if (AST.u.chance(0.3)) pushReview(AST.u.ri(1, 2), c.name);
      AST.scene && AST.scene.carLeft(c, true);
      AST.ui.toast('😠', `${c.name} не дождался`, 'Клиент уехал. Наймите механиков или добавьте боксы', 'warn');
      AST.ui.dirty('garage');
    }
  }

  const persOf = (c) => AST.data.personalities.find((p) => p.id === c.pers) || AST.data.personalities[0];

  return { tick, spawn, spawnSpecial, burst, pushReview, loyaltyAfterVisit, queueCap, ratePerHour, persOf, availableClasses };
})();
