/* ============================================================
   ИГРА: состояние (единый источник правды) и балансовые константы
   ============================================================ */
'use strict';

/* ---------- Баланс ---------- */
AST.BAL = {
  START_MONEY: 1500,
  START_REP: 10,
  SEASON_DAYS: 14,            // длительность сезона
  YEAR_DAYS: 56,              // 4 сезона
  OPEN_H: 8,                  // часы работы (базовые)
  CLOSE_H: 20,
  PARTS_MARKUP: 1.55,         // наценка на детали для клиента
  REP_MAX: 100,
  QUEUE_BASE: 3,              // базовые места в очереди
  STOCK_BASE: 60,             // базовая вместимость склада
  STAFF_BASE: 4,              // базовый лимит сотрудников
  BAY_BASE_COST: 900,         // второй бокс
  BAY_COST_MULT: 1.7,
  LIFT_TIER_COST: [0, 2500, 9000],   // апгрейд подъёмника до т.2 / т.3
  LIFT_TIER_SPEED: [1, 1.15, 1.3],
  RENT_BASE: 40,              // аренда $/день
  UTIL_BASE: 15,              // коммуналка $/день
  TAX_RATE: 0.12,             // налог с недельной прибыли
  INFLATION_YEAR: 0.04,
  DIAG_BASE_MIN: 14,          // базовая диагностика, мин
  TIP_CHANCE: 0.08,
  LAND_CAP: [2, 4, 6, 8, 10, 12],              // лимит боксов по уровню территории
  LAND_COST: [0, 5000, 20000, 60000, 150000, 400000],
  LAND_FAC_CAP: [4, 6, 8, 11, 11, 11],         // лимит построек по территории
  FRANCHISE_BASE: 25000,
  DEPOSIT_RATE: 0.01,         // 1% в день
  INSURANCE_RATE: 0.01,       // 1% стоимости склада в день
};

/* ---------- Постройки ---------- */
AST.data.facilities = [
  { id: 'wash',      name: 'Автомойка',            ico: '🧽', costs: [1200, 4800, 15000],  income: [30, 70, 140],  staff: 'washer',  counter: 'washes',   desc: 'Пассивный доход с потока машин. Мойщик удваивает эффективность.' },
  { id: 'tire',      name: 'Шиномонтаж',           ico: '⭕', costs: [1500, 6000, 18000],  income: [35, 80, 160],  staff: 'tire',    counter: 'tireSvc',  desc: 'Сезонный хит! Шиномонтажник удваивает доход.' },
  { id: 'park',      name: 'Парковка',             ico: '🅿️', costs: [800, 2500, 7000],    income: null, eff: { key: 'queueCap', val: 2 }, desc: '+2 места в очереди за уровень.' },
  { id: 'lounge',    name: 'Зона ожидания',        ico: '🛋️', costs: [1000, 3500, 10000],  income: null, eff: { key: 'patience', val: 0.15 }, desc: '+15% к терпению клиентов за уровень.' },
  { id: 'warehouse', name: 'Большой склад',        ico: '📦', costs: [1200, 4000, 12000],  income: null, eff: { key: 'stockCap', val: 80 }, desc: '+80 к вместимости склада за уровень.' },
  { id: 'diag',      name: 'Диагностический центр', ico: '💻', costs: [2500, 9000, 25000], income: [20, 45, 90], staff: 'diag', counter: 'diagSvc', eff: { key: 'diag', val: 0.20 }, desc: '+20% к скорости диагностики за уровень + доход.' },
  { id: 'office',    name: 'Офис администрации',   ico: '🗄️', costs: [3000, 10000, 28000], income: null, eff: { key: 'rpDay', val: 1 }, desc: '+1 очко исследований в день за уровень.' },
  { id: 'shop',      name: 'Магазин запчастей',    ico: '🛒', costs: [6000, 20000, 50000], income: [50, 120, 250], staff: null, counter: 'shopSales', desc: 'Продаёт запчасти в розницу. Доход растёт с ассортиментом склада.' },
  { id: 'body',      name: 'Кузовной цех',         ico: '🔨', costs: [8000, 24000, 60000], income: [80, 180, 380], staff: 'bodyman', counter: 'bodySvc', desc: 'Дорогие кузовные работы. Нужен кузовщик.' },
  { id: 'paint',     name: 'Малярная мастерская',  ico: '🎨', costs: [10000, 30000, 75000],income: [90, 200, 420], staff: 'painter', counter: 'paintSvc', desc: 'Покраска — премиальная услуга. Нужен маляр.' },
  { id: 'detail',    name: 'Детейлинг-центр',      ico: '✨', costs: [12000, 36000, 90000],income: [100, 220, 450],staff: 'washer',  counter: 'detailSvc', desc: 'Полировка, керамика, химчистка. Работает мойщик.' },
];
AST.data.facById = {};
AST.data.facilities.forEach((f) => { AST.data.facById[f.id] = f; });

/* ---------- Этапы империи (по стоимости компании) ---------- */
AST.data.tiers = [
  { name: 'Гараж у дороги',      ico: '🔧', value: 0,        bonus: null },
  { name: 'Автосервис',          ico: '🚗', value: 30000,    bonus: { money: 1500, rp: 20 } },
  { name: 'СТО',                 ico: '🏭', value: 120000,   bonus: { money: 6000, rp: 60 } },
  { name: 'Дилерский центр',     ico: '🏢', value: 1000000,  bonus: { money: 40000, rp: 150 } },
  { name: 'Международная сеть',  ico: '🌍', value: 10000000, bonus: { money: 250000, rp: 400 } },
];

/* ---------- B2B-заказчики ---------- */
AST.data.contractors = [
  { id: 'taxi',     name: 'Таксопарк «Викинг»',       ico: '🚕', cls: 'eco' },
  { id: 'delivery', name: 'Доставка «Пчела»',          ico: '📦', cls: 'van' },
  { id: 'school',   name: 'Автошкола «Старт»',         ico: '🚙', cls: 'eco' },
  { id: 'flowers',  name: 'Цветочная сеть «Пион»',     ico: '💐', cls: 'mid' },
  { id: 'builder',  name: 'Стройка «МонолитПро»',      ico: '🏗️', cls: 'pickup' },
  { id: 'hotel',    name: 'Отель «Панорама»',          ico: '🏨', cls: 'biz' },
];

/* ---------- Счётчики ---------- */
AST.COUNTERS = [
  'repairs', 'perfect', 'income', 'spent', 'clients', 'lost',
  'hires', 'fires', 'trains', 'upgrades', 'research',
  'partsBought', 'partsUsed', 'orders', 'events', 'missionsDone', 'achUnlocked',
  'reviews5', 'reviews1', 'days', 'washes', 'tireSvc', 'bodySvc', 'paintSvc',
  'detailSvc', 'diagSvc', 'shopSales', 'vip', 'franchises', 'chests', 'dailyDone',
  'streakMax', 'loans', 'errors', 'tips', 'contracts', 'regularVisits',
].concat(
  Object.keys(AST.data.faultCats).map((c) => 'cat_' + c),
  Object.keys(AST.data.carClasses).map((c) => 'cls_' + c)
);

/* ---------- Новое состояние ---------- */
AST.newState = function () {
  const c = {};
  AST.COUNTERS.forEach((k) => { c[k] = 0; });

  return {
    v: 1,
    meta: {
      name: 'Гараж у дороги',
      logo: '🔧',
      created: Date.now(),
      lastSave: Date.now(),
      playMin: 0,
      tutorialDone: false,
    },
    settings: { sound: true, music: true, autosave: true, theme: 'dark', accent: 'cyan', daySummary: true },
    tier: 0,
    contract: null,          // активный B2B-контракт
    contractOffer: null,     // предложение на столе
    regulars: [],            // постоянные клиенты
    dayMech: {},             // заработок механиков за текущий день
    lastSummary: null,       // сводка прошедшего дня
    time: { day: 1, min: 8 * 60, abs: 8 * 60, season: 0, year: 1, weather: 'sun', speed: 1 },
    money: AST.BAL.START_MONEY,
    rep: AST.BAL.START_REP,
    rp: 0,
    inflation: 1,
    ownerLvl: 1, ownerXp: 0, skillPts: 0, ownerSkills: {},
    c,
    garage: {
      bays: [{ id: 'b1', tier: 1, jobId: null, brokenUntil: 0 }],
      land: 0,
      fac: {},
    },
    staff: [],
    applicants: [],
    applicantsDay: 0,
    inv: {
      oil: 5, oil_filter: 5, air_filter: 3, cabin_filter: 2, brake_pads: 3, brake_pads_r: 2,
      spark_plugs: 2, coolant: 2, brake_fluid: 2, bulb_kit: 3, wiper_blades: 3,
      stab_link: 2, tie_rod_end: 2, battery: 1, valve_kit: 2, ball_joint: 1, shock_f: 1,
    },
    orders: [],
    partUse: {},           // pid → сколько раз деталь понадобилась (для рекомендаций закупок)
    supRel: {},
    queue: [],
    jobs: [],
    reviews: [],
    notifications: [],     // журнал уведомлений для колокольчика
    upgrades: {},
    research: { done: {}, cur: null },
    boosts: [],
    flags: {},
    missions: { claimed: {} },
    daily: { date: '', tasks: [], claimed: {}, chestClaimed: false, snap: {}, streak: 0, lastLogin: '', streakDate: '' },
    ach: { unlocked: {} },
    events: { log: [], lastAbs: 0 },
    loans: [],
    deposit: 0,
    franchises: [],
    ledger: { inc: {}, exp: {} },
    history: [],
    stats: { bestDay: 0, valuePeak: 0 },
  };
};

/* ---------- Помощники состояния ---------- */

/** Инкремент счётчика */
AST.addC = function (key, n = 1) {
  const S = AST.state;
  if (S.c[key] == null) S.c[key] = 0;
  S.c[key] += n;
};

/** Изменение репутации с затуханием у потолка и у пола */
AST.rep = function (delta) {
  const S = AST.state;
  if (delta > 0) {
    delta *= (1 + AST.mods().rep);
    delta *= Math.max(0.15, 1 - S.rep / 130);   // чем выше репутация, тем труднее расти
  } else {
    delta *= 0.4 + S.rep / 120;                 // на дне падать почти некуда
  }
  S.rep = AST.u.clamp(S.rep + delta, 0, AST.BAL.REP_MAX);
};

/** Опыт владельца + уровни */
AST.ownerXpAdd = function (xp) {
  const S = AST.state;
  S.ownerXp += Math.round(xp);
  let need = AST.ownerXpNeed(S.ownerLvl);
  while (S.ownerXp >= need) {
    S.ownerXp -= need;
    S.ownerLvl++;
    S.skillPts++;
    AST.audio.play('level');
    AST.ui && AST.ui.toast('👑', `Уровень владельца ${S.ownerLvl}!`, 'Получено 1 очко навыка', 'gold');
    AST.fx && AST.fx.confetti();
    need = AST.ownerXpNeed(S.ownerLvl);
  }
};

/** Временный эффект (буст/дебафф). delayHours — отложенный старт */
AST.addBoost = function (key, val, hours, label, delayHours = 0) {
  const S = AST.state;
  S.boosts.push({
    key, val, label,
    fromAbs: S.time.abs + delayHours * 60,
    untilAbs: S.time.abs + (delayHours + hours) * 60,
  });
  AST._modsDirty = true;
};

/** Активные бусты (и чистка отработавших) */
AST.activeBoosts = function () {
  const S = AST.state;
  const now = S.time.abs;
  const before = S.boosts.length;
  S.boosts = S.boosts.filter((b) => b.untilAbs > now);
  if (S.boosts.length !== before) AST._modsDirty = true;
  return S.boosts.filter((b) => b.fromAbs <= now);
};
