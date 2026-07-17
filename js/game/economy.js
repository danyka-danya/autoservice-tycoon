/* ============================================================
   ИГРА: экономика.
   Деньги, бухгалтерия по категориям, модификаторы (AST.mods),
   налоги, аренда, кредиты, депозит, франшизы, стоимость компании.
   ============================================================ */
'use strict';

/* ---------- Кеш модификаторов ---------- */
AST._modsDirty = true;
AST._modsCache = null;

/**
 * Сводные модификаторы всех систем.
 * Проценты складываются, применяются как (1 + m.key).
 */
AST.mods = function () {
  if (!AST._modsDirty && AST._modsCache) return AST._modsCache;
  const S = AST.state;
  const m = {
    income: 0, clients: 0, speed: 0, quality: 0, errReduce: 0, partsCost: 0,
    xp: 0, rep: 0, patience: 0, fatigueReduce: 0, rp: 0, rpDay: 0,
    stockCap: 0, queueCap: 0, diag: 0, delivery: 0, trainCost: 0, tips: 0,
    mood: 0, utilities: 0, hoursLate: 0, hoursEarly: 0, hireQ: 0,
    evSpeed: 0, luck: 0, tax: 0, blackout: 0,
  };
  const add = (key, val) => { if (key in m) m[key] += val; };

  // улучшения
  for (const id in S.upgrades) {
    const up = AST.data.upById[id];
    if (up) add(up.eff, up.val * S.upgrades[id]);
  }
  // исследования
  for (const id in S.research.done) {
    const r = AST.data.researchById[id];
    if (r && r.eff) add(r.eff.key, r.eff.val);
  }
  // навыки владельца
  for (const id in S.ownerSkills) {
    const sk = AST.data.ownerSkillById[id];
    if (sk) add(sk.eff, sk.val * S.ownerSkills[id]);
  }
  // постройки с пассивными эффектами
  for (const fid in S.garage.fac) {
    const f = AST.data.facById[fid];
    const lvl = S.garage.fac[fid];
    if (f && f.eff && lvl > 0) add(f.eff.key, f.eff.val * lvl);
  }
  // персонал с пассивными бонусами (не в отпуске и не на учёбе)
  const active = S.staff.filter((s) => !s.vacationUntil && !s.training);
  for (const s of active) {
    if (s.role === 'admin')      { add('patience', 0.15); add('clients', 0.05); }
    if (s.role === 'manager')    { add('income', 0.08); add('partsCost', 0.05); }
    if (s.role === 'accountant') { add('tax', 0.20); }
    if (s.role === 'diag')       { add('diag', 0.35); }
  }
  // временные эффекты
  for (const b of AST.activeBoosts()) add(b.key, b.val);

  m.tax = Math.min(m.tax, 0.8);
  m.errReduce = Math.min(m.errReduce, 0.85);
  m.partsCost = Math.min(m.partsCost, 0.6);
  m.utilities = Math.min(m.utilities, 0.7);

  AST._modsCache = m;
  AST._modsDirty = false;
  return m;
};

AST.econ = (() => {

  /* Скользящее окно движения денег за последний игровой час (для темпа $/ч) */
  let rateBuf = [];

  function trackRate(delta) {
    if (!AST.state) return;
    rateBuf.push({ abs: AST.state.time.abs, delta });
    if (rateBuf.length > 600) rateBuf.splice(0, 200);
  }

  /** Чистый темп за последний игровой час, $/ч */
  function incomeRate() {
    const now = AST.state.time.abs;
    rateBuf = rateBuf.filter((e) => now - e.abs <= 60);
    return Math.round(rateBuf.reduce((a, e) => a + e.delta, 0));
  }

  /* ---------- Бухгалтерия ---------- */
  function ledgerAdd(side, cat, amount) {
    const L = AST.state.ledger[side];
    L[cat] = (L[cat] || 0) + amount;
  }

  const INC_CATS = { repair: 'Ремонты', service: 'Сервисы', shop: 'Магазин', tips: 'Чаевые', franchise: 'Филиалы', deposit: 'Проценты', insurance: 'Страховка', other: 'Прочее' };
  const EXP_CATS = { salary: 'Зарплаты', parts: 'Запчасти', rent: 'Аренда', utilities: 'Коммуналка', tax: 'Налоги', marketing: 'Маркетинг', equip: 'Оборудование', build: 'Стройка', research: 'Исследования', staff: 'Персонал', loan: 'Кредиты', fine: 'Штрафы', insurance: 'Страховка', other: 'Прочее' };

  /** Доход */
  function earn(amount, cat = 'other', label = '') {
    amount = Math.round(amount);
    if (amount <= 0) return;
    AST.state.money += amount;
    AST.addC('income', amount);
    ledgerAdd('inc', cat, amount);
    trackRate(amount);
    AST.ui && AST.ui.moneyFlash(amount);
  }

  /** Обязательный расход (может увести в минус) */
  function pay(amount, cat = 'other', label = '') {
    amount = Math.round(amount);
    if (amount <= 0) return;
    AST.state.money -= amount;
    AST.addC('spent', amount);
    ledgerAdd('exp', cat, amount);
    trackRate(-amount);
    AST.ui && AST.ui.moneyFlash(-amount);
  }

  /** Добровольная покупка: false, если денег не хватает */
  function trySpend(amount, cat = 'other', label = '') {
    amount = Math.round(amount);
    if (AST.state.money < amount) {
      AST.ui && AST.ui.toast('💸', 'Не хватает денег', `Нужно ${AST.u.fmt(amount)}`, 'err');
      AST.audio.play('error');
      return false;
    }
    pay(amount, cat, label);
    return true;
  }

  /** Масштаб сумм событий/кредитов под прогресс игрока */
  function eventScale() {
    return Math.max(1, Math.pow(AST.state.c.income / 5000, 0.6));
  }

  /** Заработано/потрачено сегодня (по бухгалтерии текущего дня) */
  function todayNet() {
    const S = AST.state;
    const inc = Object.values(S.ledger.inc).reduce((a, b) => a + b, 0);
    const exp = Object.values(S.ledger.exp).reduce((a, b) => a + b, 0);
    return { inc, exp, net: inc - exp };
  }

  /** Фиксированные платежи, которые спишутся в конце дня */
  function fixedDailyCosts() {
    const S = AST.state;
    const m = AST.mods();
    const infl = S.inflation;
    const salary = Math.round(S.staff.reduce((a, st) => a + st.salary, 0) * infl);
    const rent = Math.round(AST.BAL.RENT_BASE * (1 + S.garage.land * 0.7) * infl * (1 - m.utilities));
    let facLvls = 0;
    for (const f in S.garage.fac) facLvls += S.garage.fac[f];
    let utilities = (AST.BAL.UTIL_BASE + S.garage.bays.length * 8 + facLvls * 12) * infl * (1 - m.utilities);
    if (AST.research.hasSp('solar')) utilities *= 0.5;
    utilities = Math.round(utilities);
    const loans = S.loans.reduce((a, l) => a + l.dailyPay, 0);
    const insurance = S.flags.insurance ? Math.round(AST.inv.totalValue() * AST.BAL.INSURANCE_RATE) : 0;
    return { salary, rent, utilities, loans, insurance, total: salary + rent + utilities + loans + insurance };
  }

  /** Прогноз итога дня: текущий баланс дня минус предстоящие вечерние платежи */
  function dayForecast() {
    return todayNet().net - fixedDailyCosts().total;
  }

  /* ---------- Закрытие дня ---------- */
  function dayClose() {
    const S = AST.state;
    const infl = S.inflation;
    const m = AST.mods();

    // зарплаты
    const active = S.staff;
    let salaries = 0;
    for (const st of active) salaries += st.salary;
    if (salaries > 0) pay(Math.round(salaries * infl), 'salary', 'Зарплаты за день');

    // аренда и коммуналка
    const rent = AST.BAL.RENT_BASE * (1 + S.garage.land * 0.7) * infl * (1 - m.utilities);
    pay(Math.round(rent), 'rent', 'Аренда');
    let facLvls = 0;
    for (const f in S.garage.fac) facLvls += S.garage.fac[f];
    let utils = (AST.BAL.UTIL_BASE + S.garage.bays.length * 8 + facLvls * 12) * infl * (1 - m.utilities);
    if (AST.research.hasSp('solar')) utils *= 0.5;
    pay(Math.round(utils), 'utilities', 'Коммунальные платежи');

    // страховка склада
    if (S.flags.insurance) {
      const fee = Math.round(AST.inv.totalValue() * AST.BAL.INSURANCE_RATE);
      if (fee > 0) pay(fee, 'insurance', 'Страховой взнос');
    }

    // кредиты
    for (const loan of S.loans) {
      pay(loan.dailyPay, 'loan', 'Платёж по кредиту');
      loan.leftDays--;
    }
    const finished = S.loans.filter((l) => l.leftDays <= 0).length;
    if (finished > 0) AST.ui && AST.ui.toast('🏦', 'Кредит погашен!', '', 'ok');
    S.loans = S.loans.filter((l) => l.leftDays > 0);

    // депозит
    if (S.deposit > 0) {
      const interest = Math.round(S.deposit * AST.BAL.DEPOSIT_RATE);
      S.deposit += interest;
      ledgerAdd('inc', 'deposit', 0); // проценты капитализируются, в кассу не идут
    }

    // франшизы
    for (const fr of S.franchises) {
      earn(franchiseDaily(fr), 'franchise', `Филиал «${fr.city}»`);
    }

    // очки исследований за день (офис, цифровизация)
    if (m.rpDay > 0) {
      AST.research.addRp(m.rpDay);
    }

    // итоги дня в историю
    const inc = Object.values(S.ledger.inc).reduce((a, b) => a + b, 0);
    const exp = Object.values(S.ledger.exp).reduce((a, b) => a + b, 0);
    const snap = S.daily.snap || {};
    S.history.push({
      day: S.time.day,
      income: inc, expenses: exp, profit: inc - exp,
      clients: S.c.clients - (snap.clients || 0),
      repairs: S.c.repairs - (snap.repairs || 0),
      rep: Math.round(S.rep),
      money: Math.round(S.money),
    });

    // сводка дня (для утренней карточки)
    let bestMech = null;
    for (const id in S.dayMech) {
      const st = S.staff.find((x) => x.id === id);
      if (st && (!bestMech || S.dayMech[id] > bestMech.earned)) {
        bestMech = { name: st.name, emoji: st.emoji, earned: S.dayMech[id] };
      }
    }
    S.lastSummary = {
      day: S.time.day,
      income: inc, expenses: exp, profit: inc - exp,
      clients: S.c.clients - (snap.clients || 0),
      repairs: S.c.repairs - (snap.repairs || 0),
      lost: S.c.lost - (snap.lost || 0),
      perfect: S.c.perfect - (snap.perfect || 0),
      bestMech,
    };
    S.dayMech = {};
    if (S.history.length > 400) S.history.shift();
    if (inc - exp > (S.stats.bestDay || 0)) S.stats.bestDay = inc - exp;
    S.ledger = { inc: {}, exp: {} };

    // налоги раз в неделю с прибыли
    if (S.time.day % 7 === 0) {
      const week = S.history.slice(-7);
      const profit = week.reduce((a, d) => a + Math.max(0, d.profit), 0);
      const tax = Math.round(profit * AST.BAL.TAX_RATE * (1 - m.tax));
      if (tax > 0) {
        pay(tax, 'tax', 'Налог за неделю');
        AST.ui && AST.ui.toast('🧾', 'Уплачен налог', AST.u.fmt(tax), 'warn');
      }
    }

    // предупреждение о минусе
    if (S.money < 0) {
      AST.ui && AST.ui.toast('🚨', 'Касса в минусе!', 'Возьмите кредит во вкладке «Финансы» или продайте оборудование', 'err');
    }
  }

  /* ---------- Кредиты ---------- */
  function loanOffers() {
    const s = eventScale();
    return [
      { id: 'small', name: 'Микрозайм',       ico: '💳', principal: Math.round(1500 * s), days: 8,  rate: 1.15 },
      { id: 'mid',   name: 'Бизнес-кредит',   ico: '🏦', principal: Math.round(6000 * s), days: 20, rate: 1.25 },
      { id: 'big',   name: 'Инвест-кредит',   ico: '🏛️', principal: Math.round(25000 * s), days: 45, rate: 1.35 },
    ];
  }

  function takeLoan(offer) {
    const S = AST.state;
    if (S.loans.length >= 3) {
      AST.ui.toast('🏦', 'Банк отказал', 'Не больше 3 кредитов одновременно', 'err');
      return false;
    }
    const total = Math.round(offer.principal * offer.rate);
    S.loans.push({
      id: AST.u.uid(), name: offer.name,
      principal: offer.principal, total,
      dailyPay: Math.ceil(total / offer.days),
      leftDays: offer.days,
    });
    earn(offer.principal, 'other', 'Кредит: ' + offer.name);
    AST.addC('loans');
    AST.audio.play('cash');
    return true;
  }

  /* ---------- Депозит ---------- */
  function depositAdd(amount) {
    if (!trySpend(amount, 'other', 'Пополнение депозита')) return false;
    AST.state.deposit += amount;
    // пополнение — не расход бизнеса, вернём в счётчик
    AST.state.c.spent -= amount;
    return true;
  }
  function depositTake(amount) {
    const S = AST.state;
    amount = Math.min(amount, S.deposit);
    if (amount <= 0) return false;
    S.deposit -= amount;
    S.money += amount;
    return true;
  }

  /* ---------- Франшизы ---------- */

  /** Дневная прибыль одного филиала */
  function franchiseDaily(fr) {
    const S = AST.state;
    const dirBonus = S.staff.some((s) => s.role === 'director') ? 1.25 : 1;
    return Math.round(fr.cost * 0.045 * (0.5 + S.rep / 100) * dirBonus * S.inflation);
  }

  /** Все филиалы, $/день */
  function franchiseDailyTotal() {
    return AST.state.franchises.reduce((a, fr) => a + franchiseDaily(fr), 0);
  }

  function franchiseCost() {
    return Math.round(AST.BAL.FRANCHISE_BASE * Math.pow(2, AST.state.franchises.length) * AST.state.inflation);
  }
  function franchiseBuy() {
    const S = AST.state;
    if (!AST.research.hasSp('franchise')) return false;
    const cost = franchiseCost();
    if (!trySpend(cost, 'build', 'Открытие филиала')) return false;
    const used = new Set(S.franchises.map((f) => f.city));
    const city = AST.data.names.cities.find((ct) => !used.has(ct)) || ('Город-' + (S.franchises.length + 1));
    S.franchises.push({ city, cost, day: S.time.day });
    AST.addC('franchises');
    AST.audio.play('achievement');
    AST.fx && AST.fx.confetti();
    AST.ui.toast('🏪', `Филиал в городе ${city}!`, 'Будет приносить прибыль каждый день', 'gold');
    return true;
  }

  /* ---------- Этапы империи ---------- */
  function checkTier() {
    const S = AST.state;
    const next = AST.data.tiers[S.tier + 1];
    if (!next || value() < next.value) return;
    S.tier++;
    if (next.bonus) {
      earn(next.bonus.money, 'other', 'Бонус за новый статус');
      AST.research.addRp(next.bonus.rp);
    }
    AST.audio.play('achievement');
    AST.fx && AST.fx.confetti(60);
    AST.scene && AST.scene.refresh();
    AST.ui.updateHud();
    AST.modal.show({
      ico: next.ico,
      title: `Новый статус: ${next.name}!`,
      body: `<p class="tac">Стоимость вашей компании превысила <b>${AST.u.fmt(next.value)}</b>.</p>
        <p class="tac">Вы больше не «${AST.u.esc(AST.data.tiers[S.tier - 1].name)}» — теперь это <b>${AST.u.esc(next.name)}</b>!
        ${next.bonus ? `<br><br>🎁 Премия: <b class="good">${AST.u.fmt(next.bonus.money)}</b> и <b class="accent">${next.bonus.rp} 🔬</b>` : ''}</p>
        ${AST.data.tiers[S.tier + 1] ? `<p class="tac small muted">Следующий рубеж: ${AST.data.tiers[S.tier + 1].name} — ${AST.u.fmt(AST.data.tiers[S.tier + 1].value)}</p>` : '<p class="tac gold-c"><b>Это вершина. Империя построена!</b></p>'}`,
      buttons: [{ label: '🎉 Отлично!', primary: true }],
    });
  }

  /* ---------- Стоимость компании ---------- */
  function value() {
    const S = AST.state;
    let v = S.money + S.deposit;
    // боксы и подъёмники
    S.garage.bays.forEach((b, i) => {
      v += 900 * Math.pow(1.35, i);
      v += AST.BAL.LIFT_TIER_COST[b.tier - 1] || 0;
    });
    // территория
    for (let i = 1; i <= S.garage.land; i++) v += AST.BAL.LAND_COST[i] || 0;
    // постройки
    for (const fid in S.garage.fac) {
      const f = AST.data.facById[fid];
      if (!f) continue;
      for (let l = 0; l < S.garage.fac[fid]; l++) v += f.costs[l] || 0;
    }
    // склад и филиалы
    v += AST.inv.totalValue();
    S.franchises.forEach((fr) => { v += fr.cost; });
    if (v > (S.stats.valuePeak || 0)) S.stats.valuePeak = v;
    return Math.round(v);
  }

  return { earn, pay, trySpend, eventScale, incomeRate, todayNet, fixedDailyCosts, dayForecast, dayClose, checkTier, loanOffers, takeLoan, depositAdd, depositTake, franchiseCost, franchiseBuy, franchiseDaily, franchiseDailyTotal, value, INC_CATS, EXP_CATS };
})();
