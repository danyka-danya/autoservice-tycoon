/* ============================================================
   ДАННЫЕ: случайные события (28 видов).
   Функции apply() выполняются в момент события — им доступны
   AST.econ, AST.state и другие модули (позднее связывание).
   Каждая apply() возвращает строку-результат для игрока.
   ============================================================ */
'use strict';

/* Короткие ссылки внутри событий (вычисляются в момент вызова) */
const EV$ = () => AST.econ.eventScale();   // масштаб сумм под прогресс игрока

AST.data.events = [
  {
    id: 'tax_audit', name: 'Налоговая проверка', ico: '🧾', weight: 5, bad: true,
    text: 'В сервис пришёл инспектор. Он внимательно смотрит на стопку ваших накладных.',
    choices: [
      { label: 'Показать все документы', apply() {
        const hasAcc = AST.state.staff.some((s) => s.role === 'accountant');
        if (hasAcc) { AST.rep(2); return 'Бухгалтер подготовил идеальную отчётность. Инспектор ушёл довольный, репутация +2.'; }
        const fine = Math.round(180 * EV$());
        AST.econ.pay(fine, 'fine', 'Штраф налоговой');
        return `Нашлись мелкие нарушения. Штраф ${AST.u.fmt(fine)}. Бухгалтер бы помог…`;
      } },
      { label: 'Угостить кофе и поговорить', apply() {
        if (AST.u.chance(0.5 + AST.mods().luck * 0.5)) { return 'Разговор удался — инспектор ограничился предупреждением.'; }
        const fine = Math.round(320 * EV$());
        AST.econ.pay(fine, 'fine', 'Штраф налоговой');
        AST.rep(-2);
        return `Инспектор счёл это давлением. Штраф ${AST.u.fmt(fine)} и −2 к репутации.`;
      } },
    ],
  },
  {
    id: 'power_out', name: 'Отключение электричества', ico: '🔌', weight: 6, bad: true,
    cond: () => !AST.state.flags.generator,
    text: 'Во всём районе пропал свет. Подъёмники и инструменты обесточены.',
    choices: [
      { label: 'Купить генератор ($800)', apply() {
        if (!AST.econ.trySpend(800, 'equip', 'Дизель-генератор')) return 'Не хватило денег — пришлось пережидать. Работа стояла 2 часа.';
        AST.state.flags.generator = true;
        return 'Генератор затарахтел — работа продолжается! Отключения вам больше не страшны.';
      } },
      { label: 'Переждать', apply() {
        AST.addBoost('blackout', 1, 2, 'Нет электричества');
        return 'Механики пьют чай. Ремонты остановлены на 2 часа.';
      } },
    ],
  },
  {
    id: 'lift_break', name: 'Сломался подъёмник', ico: '🛠️', weight: 6, bad: true,
    cond: () => AST.state.garage.bays.length > 0,
    text: 'Один из подъёмников заклинило под нагрузкой. Бокс не работает.',
    choices: [
      { label: 'Вызвать сервис ($400)', apply() {
        if (!AST.econ.trySpend(400, 'equip', 'Ремонт подъёмника')) { AST.garage.breakRandomBay(8); return 'Денег нет — бокс простоит 8 часов, чиним сами.'; }
        AST.garage.breakRandomBay(1);
        return 'Мастера приехали быстро. Бокс вернётся в строй через час.';
      } },
      { label: 'Чинить своими силами', apply() {
        AST.garage.breakRandomBay(5);
        return 'Механики разобрались сами. Бокс не работает 5 часов.';
      } },
    ],
  },
  {
    id: 'fire_small', name: 'Задымление на складе', ico: '🔥', weight: 3, bad: true,
    cond: () => !AST.research.hasSp('sprinkler') && AST.inv.totalQty() > 10,
    text: 'Короткое замыкание — на складе вспыхнула проводка! Огонь потушили, но часть деталей испорчена.',
    choices: [
      { label: 'Оценить ущерб', apply() {
        const lost = AST.inv.loseRandom(0.12);
        AST.rep(-2);
        return `Сгорело ${lost} ${AST.u.plural(lost, 'деталь', 'детали', 'деталей')}. Защита: Наука → ветка «Оборудование» → «Пожарная система». А пока выручит страховка во вкладке «Финансы» (вернёт 80% ущерба).`;
      } },
    ],
  },
  {
    id: 'theft', name: 'Кража со склада', ico: '🥷', weight: 3, bad: true,
    cond: () => !AST.research.hasSp('security') && AST.inv.totalQty() > 10,
    text: 'Ночью кто-то влез через окно склада. Замок сломан, на полках пусто.',
    choices: [
      { label: 'Подать заявление', apply() {
        const lost = AST.inv.loseRandom(0.10);
        return `Украдено ${lost} ${AST.u.plural(lost, 'деталь', 'детали', 'деталей')}. Защита: Наука → ветка «Оборудование» → «Охранная система» (это исследование, а не сотрудник). А пока включите страховку во вкладке «Финансы» — вернёт 80% ущерба.`;
      } },
    ],
  },
  {
    id: 'blogger_visit', name: 'Приехал автоблогер', ico: '🤳', weight: 4,
    text: 'Известный автоблогер с миллионом подписчиков заехал «проверить сервис на честность».',
    choices: [
      { label: 'Обслужить бесплатно', apply() {
        const cost = Math.round(90 * EV$());
        AST.econ.pay(cost, 'marketing', 'Бесплатный ремонт блогеру');
        AST.rep(7);
        AST.addBoost('clients', 0.4, 24, 'Обзор блогера');
        return `Восторженный обзор! Репутация +7, поток клиентов вырос на сутки. Ремонт обошёлся в ${AST.u.fmt(cost)}.`;
      } },
      { label: 'Обслужить как всех', apply() {
        if (AST.u.chance(0.55 + AST.mods().luck)) { AST.rep(4); return '«Честный сервис, рекомендую!» — репутация +4.'; }
        AST.rep(-4);
        return 'Блогеру не понравилась очередь. Едкий ролик: репутация −4.';
      } },
    ],
  },
  {
    id: 'rare_car', name: 'Коллекционер', ico: '🏛️', weight: 3,
    cond: () => AST.state.rep >= 40,
    text: 'Владелец коллекционного автомобиля ищет мастерскую, которой можно доверить жемчужину своего гаража.',
    choices: [
      { label: 'Принять заказ', apply() { AST.clients.spawnSpecial('rare'); return 'Редкий автомобиль уже въезжает на территорию. Не подведите!'; } },
      { label: 'Отказаться', apply() { return 'Коллекционер уехал искать другой сервис.'; } },
    ],
  },
  {
    id: 'supplier_sale', name: 'Распродажа у поставщика', ico: '🏷️', weight: 6,
    text: 'Один из поставщиков объявил ликвидацию склада: скидки на всё 30% ровно сутки!',
    choices: [
      { label: 'Отлично!', apply() { AST.addBoost('partsCost', 0.30, 24, 'Распродажа у поставщика'); return 'Сутки запчасти дешевле на 30%. Самое время затариться!'; } },
    ],
  },
  {
    id: 'season_rush', name: 'Наплыв клиентов', ico: '🌊', weight: 6,
    text: 'В городе большой автопробег — машин на дорогах в разы больше обычного.',
    choices: [
      { label: 'К работе!', apply() { AST.addBoost('clients', 0.5, 24, 'Наплыв клиентов'); return 'Поток клиентов +50% на сутки!'; } },
    ],
  },
  {
    id: 'crisis', name: 'Экономический спад', ico: '📉', weight: 3, bad: true,
    cond: () => AST.state.time.day > 20,
    text: 'Новости говорят о кризисе. Люди экономят и откладывают ремонты.',
    choices: [
      { label: 'Переживём', apply() { AST.addBoost('clients', -0.3, 72, 'Кризис'); AST.addBoost('income', -0.1, 72, 'Кризис'); return 'Три дня будет тяжело: клиентов на 30% меньше, чеки ниже.'; } },
    ],
  },
  {
    id: 'competitor_promo', name: 'Акция конкурентов', ico: '⚔️', weight: 5, bad: true,
    text: 'Сервис через дорогу объявил «минус 40% на всё». Ваши клиенты поглядывают в их сторону.',
    choices: [
      { label: 'Ответная акция', apply() {
        const cost = Math.round(150 * EV$());
        if (!AST.econ.trySpend(cost, 'marketing', 'Ответная акция')) { AST.addBoost('clients', -0.25, 48, 'Демпинг конкурентов'); return 'Нет денег на акцию. Клиентов меньше на 2 дня.'; }
        return `Провели свою акцию за ${AST.u.fmt(cost)} — клиенты остались с вами.`;
      } },
      { label: 'Игнорировать', apply() { AST.addBoost('clients', -0.25, 48, 'Демпинг конкурентов'); return 'Часть клиентов ушла на дешёвку. Поток −25% на 2 дня.'; } },
    ],
  },
  {
    id: 'raise_request', name: 'Просьба о прибавке', ico: '🙏', weight: 5,
    cond: () => AST.state.staff.length > 0,
    text: 'Один из сотрудников набрался смелости и просит повышения зарплаты на 20%.',
    choices: [
      { label: 'Повысить', apply() {
        const s = AST.u.pick(AST.state.staff);
        s.salary = Math.round(s.salary * 1.2); s.mood = Math.min(100, s.mood + 25);
        return `${s.name} сияет от счастья и готов работать вдвое усерднее!`;
      } },
      { label: 'Отказать', apply() {
        const s = AST.u.pick(AST.state.staff);
        s.mood = Math.max(0, s.mood - 20);
        return `${s.name} расстроен. Следите за настроением — может уволиться.`;
      } },
    ],
  },
  {
    id: 'sick_staff', name: 'Сотрудник заболел', ico: '🤒', weight: 5, bad: true,
    cond: () => AST.state.staff.some((s) => !s.vacationUntil),
    text: 'Утром позвонил сотрудник: температура, врач прописал постельный режим.',
    choices: [
      { label: 'Оплатить лечение ($200)', apply() {
        const s = AST.u.pick(AST.state.staff.filter((x) => !x.vacationUntil));
        if (!s) return 'Все и так отдыхают.';
        if (!AST.econ.trySpend(200, 'staff', 'Лечение сотрудника')) { s.vacationUntil = AST.state.time.day + 2; return 'Денег нет — болеет 2 дня.'; }
        s.vacationUntil = AST.state.time.day + 1; s.mood = Math.min(100, s.mood + 10);
        return `${s.name} вернётся уже завтра и благодарен за заботу.`;
      } },
      { label: 'Пусть отлежится', apply() {
        const s = AST.u.pick(AST.state.staff.filter((x) => !x.vacationUntil));
        if (!s) return 'Все и так отдыхают.';
        s.vacationUntil = AST.state.time.day + 2;
        return `${s.name} выбыл на 2 дня.`;
      } },
    ],
  },
  {
    id: 'lottery_client', name: 'Юбилейный клиент', ico: '🎉', weight: 4,
    cond: () => AST.state.c.clients >= 50,
    text: `Сегодняшний клиент оказался юбилейным! Местная газета уже приехала за фотографией.`,
    choices: [
      { label: 'Подарить бесплатное ТО', apply() { AST.rep(5); return 'Тёплый репортаж в газете: репутация +5!'; } },
    ],
  },
  {
    id: 'wedding', name: 'Свадебный кортеж', ico: '💒', weight: 4,
    text: 'Свадебный кортеж по пути в загс заметил вашу мойку. Молодожёны хотят блестящие машины!',
    choices: [
      { label: 'Принять кортеж', apply() { AST.clients.burst(3); return 'Три машины уже заезжают на территорию!'; } },
    ],
  },
  {
    id: 'movie_shoot', name: 'Киносъёмка', ico: '🎬', weight: 3,
    cond: () => AST.state.garage.bays.length >= 3,
    text: 'Кинокомпания снимает сцену в «настоящем автосервисе» и предлагает аренду одного бокса на день.',
    choices: [
      { label: 'Разрешить съёмку', apply() {
        const pay = Math.round(900 * EV$());
        AST.econ.earn(pay, 'other', 'Аренда под киносъёмку');
        AST.garage.breakRandomBay(10);
        AST.rep(3);
        return `Гонорар ${AST.u.fmt(pay)} и +3 к репутации! Один бокс занят съёмками 10 часов.`;
      } },
      { label: 'Отказать', apply() { return 'Киношники уехали искать другую локацию.'; } },
    ],
  },
  {
    id: 'charity', name: 'Просьба о помощи', ico: '🤲', weight: 4,
    text: 'Многодетная семья просит недорого починить их старенький минивэн — иначе детей не на чем возить в школу.',
    choices: [
      { label: 'Починить бесплатно', apply() {
        const cost = Math.round(60 * EV$());
        AST.econ.pay(cost, 'other', 'Благотворительный ремонт');
        AST.rep(6); AST.staffM.moodAll(5);
        return `Семья счастлива, команда горда, город говорит о вас. Репутация +6.`;
      } },
      { label: 'Вежливо отказать', apply() { AST.rep(-2); return 'Семья уехала. Осадочек остался: репутация −2.'; } },
    ],
  },
  {
    id: 'vet_mechanic', name: 'Мастер старой школы', ico: '🧙', weight: 3,
    cond: () => AST.staffM.canHire(),
    text: 'В сервис зашёл седой мастер: «Сорок лет кручу гайки. Возьмёте? Много не прошу».',
    choices: [
      { label: 'Нанять легенду', apply() { const s = AST.staffM.hireVeteran(); return `${s.name} надел фирменный комбинезон. Навык ${s.skill}/10 — настоящая находка!`; } },
      { label: 'Отказать', apply() { return 'Мастер пожал плечами и ушёл. Возможно, к конкурентам.'; } },
    ],
  },
  {
    id: 'parts_delay', name: 'Поставщик подвёл', ico: '📦', weight: 5, bad: true,
    cond: () => AST.state.orders.length > 0,
    text: 'Звонок от логистов: «Фура сломалась на трассе, груз задерживается».',
    choices: [
      { label: 'Ничего не поделать', apply() { AST.state.orders.forEach((o) => { o.etaMin += 360; }); return 'Все текущие заказы задержатся на 6 часов.'; } },
    ],
  },
  {
    id: 'fire_inspect', name: 'Пожарная инспекция', ico: '🚒', weight: 4,
    text: 'Плановая проверка пожарной безопасности. Инспектор ходит по цеху с планшетом.',
    choices: [
      { label: 'Провести по объекту', apply() {
        if (AST.research.hasSp('sprinkler')) { AST.rep(3); return 'Автоматическая система тушения впечатлила инспектора. Репутация +3.'; }
        const fine = Math.round(140 * EV$());
        AST.econ.pay(fine, 'fine', 'Штраф пожарной инспекции');
        return `Есть замечания. Штраф ${AST.u.fmt(fine)}. Исследуйте «Пожарную систему».`;
      } },
    ],
  },
  {
    id: 'flashmob', name: 'Слёт автолюбителей', ico: '🚗', weight: 4,
    text: 'Неподалёку собрался стихийный слёт тюнингованных машин. Половина из них «постукивает».',
    choices: [
      { label: 'Раздать визитки', apply() { AST.addBoost('clients', 0.35, 12, 'Слёт автолюбителей'); return 'Пол-слёта записалось к вам! Поток клиентов +35% на 12 часов.'; } },
    ],
  },
  {
    id: 'oil_spill', name: 'Разлив масла в цехе', ico: '🛢️', weight: 5, bad: true,
    cond: () => AST.state.garage.bays.length > 0,
    text: 'Бочка с отработкой опрокинулась — пол цеха в масле, работать опасно.',
    choices: [
      { label: 'Вызвать клининг ($150)', apply() {
        if (!AST.econ.trySpend(150, 'other', 'Клининг цеха')) { AST.addBoost('speed', -0.3, 4, 'Разлив масла'); return 'Денег нет — убираем сами, работы идут медленнее 4 часа.'; }
        return 'Через час цех блестит. Работа не остановилась.';
      } },
      { label: 'Убрать самим', apply() { AST.addBoost('speed', -0.3, 4, 'Разлив масла'); return 'Механики с тряпками вместо ключей: скорость −30% на 4 часа.'; } },
    ],
  },
  {
    id: 'viral_good', name: 'Отзыв завирусился', ico: '🌟', weight: 4,
    cond: () => AST.state.c.reviews5 >= 5,
    text: 'Довольный клиент написал пост о вашем сервисе, и он разлетелся по всему городу!',
    choices: [
      { label: 'Класс!', apply() { AST.rep(4); AST.addBoost('clients', 0.3, 24, 'Вирусный отзыв'); return 'Репутация +4, клиенты едут по рекомендации!'; } },
    ],
  },
  {
    id: 'viral_bad', name: 'Хейт в сети', ico: '💢', weight: 3, bad: true,
    cond: () => AST.state.rep < 70 && AST.state.c.clients > 20,
    text: 'Недовольный клиент раздул скандал в соцсетях. Комментарии кипят.',
    choices: [
      { label: 'Публично извиниться и исправить', apply() {
        const cost = Math.round(80 * EV$());
        AST.econ.pay(cost, 'marketing', 'Работа с негативом');
        AST.rep(-1);
        return `Честный ответ погасил скандал. Лёгкие потери: −1 репутации и ${AST.u.fmt(cost)}.`;
      } },
      { label: 'Игнорировать', apply() { AST.rep(-5); return 'Молчание сочли высокомерием. Репутация −5.'; } },
    ],
  },
  {
    id: 'treasure', name: 'Тайник в старой машине', ico: '💰', weight: 2,
    text: 'При разборке двери старого седана механик нашёл свёрток с купюрами. Владелец махнул рукой: «Оставьте себе, это дедово».',
    choices: [
      { label: 'Невероятно!', apply() { const sum = Math.round(400 * EV$()); AST.econ.earn(sum, 'other', 'Находка в машине'); return `Неожиданный бонус: ${AST.u.fmt(sum)}!`; } },
    ],
  },
  {
    id: 'auction_lift', name: 'Аукцион техники', ico: '🔨', weight: 4,
    cond: () => AST.research.hasSp('auction') && AST.garage.canAddBay(),
    text: 'На аукционе распродают технику закрывшегося сервиса. Подъёмник в отличном состоянии — почти даром!',
    choices: [
      { label: 'Купить со скидкой 40%', apply() {
        const price = Math.round(AST.garage.nextBayCost() * 0.6);
        if (!AST.econ.trySpend(price, 'equip', 'Подъёмник с аукциона')) return 'Не хватило денег — лот ушёл другому покупателю.';
        AST.garage.addBay(1);
        return `Новый бокс за ${AST.u.fmt(price)} — отличная сделка!`;
      } },
      { label: 'Пропустить', apply() { return 'Лот ушёл с молотка другому сервису.'; } },
    ],
  },
  {
    id: 'heatwave', name: 'Аномальная жара', ico: '🥵', weight: 4,
    cond: () => AST.state.time.season === 1,
    text: 'Столбик термометра пробил +38°. Кондиционеры в машинах сдаются один за другим.',
    choices: [
      { label: 'Жаркий сезон!', apply() { AST.addBoost('clients', 0.3, 24, 'Жара'); AST.addBoost('income', 0.1, 24, 'Жара'); return 'Очередь на заправку кондиционеров! +30% клиентов на сутки.'; } },
    ],
  },
  {
    id: 'snowstorm', name: 'Метель', ico: '🌨️', weight: 4,
    cond: () => AST.state.time.season === 3,
    text: 'Город замело. Дороги встали, эвакуаторы не справляются.',
    choices: [
      { label: 'Переждать', apply() { AST.addBoost('clients', -0.5, 12, 'Метель'); AST.addBoost('clients', 0.4, 24, 'После метели', 12); return 'Полдня тишины, зато потом — вал побитых и замёрзших машин!'; } },
    ],
  },
];
