/* ============================================================
   UI: вкладки «Персонал», «Склад», «Улучшения»
   ============================================================ */
'use strict';

AST.actions = AST.actions || {};
AST.inputs = AST.inputs || {};

/* ============================================================
   ПЕРСОНАЛ
   ============================================================ */
AST.panels.staff = function (root) {
  const S = AST.state;
  const fot = S.staff.reduce((a, s) => a + s.salary, 0);

  const statBar = (label, val, max, cls, tip) => `
    <div class="stat-line" ${tip ? `title="${AST.u.esc(tip)}"` : ''}>
      <span class="sl-lab">${label}</span>
      <div class="bar ${cls || ''}"><div class="bar-fill" style="width:${AST.u.clamp((val / max) * 100, 0, 100)}%"></div></div>
      <span class="sl-val">${Math.round(val)}</span>
    </div>`;

  function staffCard(st) {
    const role = AST.data.roles[st.role];
    const spec = st.spec ? AST.data.specs.find((x) => x.id === st.spec) : null;
    const traits = st.traits.map((tid) => {
      const t = AST.data.traits.find((x) => x.id === tid);
      return t ? `<span class="chip" title="${AST.u.esc(t.desc)}">${t.ico} ${t.name}</span>` : '';
    }).join('');
    /* роли, привязанные к постройкам: показываем, где человек работает */
    const FAC_OF_ROLE = { washer: 'wash', tire: 'tire', bodyman: 'body', painter: 'paint', diag: 'diag' };
    const OFFICE_ROLES = ['admin', 'manager', 'accountant', 'director'];
    let stateNote = '';
    if (st.vacationUntil) stateNote = `<span class="pill amber">🏖️ отпуск до дня ${st.vacationUntil}</span>`;
    else if (st.training) stateNote = `<span class="pill acc">🎓 на курсах</span>`;
    else if (st.role === 'mechanic') {
      stateNote = AST.state.jobs.some((j) => j.mechId === st.id)
        ? '<span class="pill green">🔧 работает</span>'
        : '<span class="pill grey">☕ ожидает клиента</span>';
    } else if (FAC_OF_ROLE[st.role]) {
      let facId = FAC_OF_ROLE[st.role];
      // мойщик обслуживает и детейлинг
      if (st.role === 'washer' && !AST.garage.facLevel('wash') && AST.garage.facLevel('detail')) facId = 'detail';
      const fac = AST.data.facById[facId];
      if (AST.garage.facLevel(facId) > 0) {
        stateNote = AST.time.isOpen()
          ? `<span class="pill green">${fac.ico} «${AST.u.esc(fac.name)}» приносит доход</span>`
          : '<span class="pill grey">🌙 до утра</span>';
      } else {
        stateNote = `<span class="pill red">⚠️ постройте: ${AST.u.esc(fac.name)}</span>`;
      }
    } else if (OFFICE_ROLES.includes(st.role)) {
      stateNote = '<span class="pill green">📈 даёт бонусы компании</span>';
    } else {
      stateNote = '<span class="pill grey">☕ ожидает</span>';
    }

    const isMech = st.role === 'mechanic';
    return `
      <div class="card hover">
        <div class="row gap12">
          <div class="avatar lg">${st.emoji}</div>
          <div class="flex1">
            <div class="row wrap gap4"><b>${AST.u.esc(st.name)}</b><span class="lvl-badge">${st.lvl}</span>${stateNote}</div>
            <div class="small muted">${role.ico} ${role.name}${spec ? ` • ${spec.ico} ${spec.name}` : ''} • ${st.age} лет</div>
            <div class="small muted">💵 ${AST.u.fmt(st.salary)}/день</div>
          </div>
        </div>
        ${isMech ? `<div class="col mt8" style="gap:4px">
          ${statBar('Навык', st.skill, 10, '', 'Какие работы по плечу: простые требуют 1–2, ремонт двигателя — 8. Не дорос — растёт шанс ошибки. Качается курсами и опытом')}
          ${statBar('Настроение', st.mood, 100, st.mood > 50 ? 'green' : st.mood > 25 ? 'amber' : 'red', 'Выше 80 — работает на 8% быстрее. Ниже 15 — может уволиться! Поднимают прибавки, отпуск и улучшения «Забота о команде»')}
          ${statBar('Усталость', st.fatigue, 100, st.fatigue < 50 ? 'green' : st.fatigue < 80 ? 'amber' : 'red', 'Выше 70 — работает заметно медленнее, выше 80 — чаще ошибается. Сбрасывается ночью и отпуском')}
        </div>` : `<div class="col mt8" style="gap:4px">
          ${statBar('Настроение', st.mood, 100, st.mood > 50 ? 'green' : st.mood > 25 ? 'amber' : 'red', 'Ниже 15 — может уволиться! Поднимают прибавки и улучшения «Забота о команде»')}
        </div>`}
        ${traits ? `<div class="row wrap mt8">${traits}</div>` : ''}
        ${isMech && st.stats && st.stats.repairs > 0 ? `
          <div class="small muted mt8" title="Личная статистика за всё время работы у вас">
            💰 принёс <b class="good">${AST.u.fmt(st.stats.earned)}</b> • 🔧 ${st.stats.repairs} ${AST.u.plural(st.stats.repairs, 'ремонт', 'ремонта', 'ремонтов')} • ⭐ ${st.stats.fivestars} на 5★
          </div>` : ''}
        <div class="row wrap mt8">
          ${isMech && st.skill < 10 && !st.training && !st.vacationUntil
            ? `<button class="btn tiny" data-act="stTrain" data-id="${st.id}" title="День на учёбе → +1 к навыку и выше качество. Высокий навык = сложные дорогие ремонты без ошибок">🎓 Курсы <span class="price">${AST.u.fmt(AST.staffM.trainCost(st))}</span></button>` : ''}
          ${!st.vacationUntil && !st.training
            ? `<button class="btn tiny" data-act="stVac" data-id="${st.id}" title="3 дня отдыха: усталость обнулится, настроение вырастет">🏖️ Отпуск <span class="price">${AST.u.fmt(st.salary * 2)}</span></button>` : ''}
          <button class="btn tiny" data-act="stRaise" data-id="${st.id}" title="Зарплата +15% навсегда, настроение +18. Довольный сотрудник работает быстрее и не уволится">💵 Прибавка +15%</button>
          <button class="btn tiny ghost" data-act="stFire" data-id="${st.id}" title="Выходное пособие — 3 дневных зарплаты. Команда немного расстроится">🚪 Уволить</button>
        </div>
      </div>`;
  }

  function appCard(a) {
    const role = AST.data.roles[a.role];
    const spec = a.spec ? AST.data.specs.find((x) => x.id === a.spec) : null;
    const traits = a.traits.map((tid) => {
      const t = AST.data.traits.find((x) => x.id === tid);
      return t ? `<span class="chip" title="${AST.u.esc(t.desc)}">${t.ico} ${t.name}</span>` : '';
    }).join('');
    return `
      <div class="card hover">
        <div class="row gap12">
          <div class="avatar lg">${a.emoji}</div>
          <div class="flex1">
            <b>${AST.u.esc(a.name)}</b>
            <div class="small muted">${role.ico} ${role.name}${spec ? ` • ${spec.ico} ${spec.name}` : ''} • ${a.age} лет</div>
            <div class="small">Навык: <b>${a.skill}/10</b> • Хочет: <b>${AST.u.fmt(a.salary)}/день</b></div>
          </div>
        </div>
        ${traits ? `<div class="row wrap mt8">${traits}</div>` : ''}
        <button class="btn primary small wide mt8" data-act="stHire" data-id="${a.id}">
          🤝 Нанять <span class="price">${AST.u.fmt(Math.round(a.salary * 1.5))}</span>
        </button>
      </div>`;
  }

  root.innerHTML = `
    <div class="grid4 mb12">
      <div class="tile"><div class="tile-val">${S.staff.length} / ${AST.staffM.staffCap()}</div><div class="tile-lab">👥 Штат</div></div>
      <div class="tile"><div class="tile-val">${AST.u.fmt(fot)}</div><div class="tile-lab">💵 Зарплаты в день</div></div>
      <div class="tile"><div class="tile-val">${S.staff.filter((s) => s.role === 'mechanic').length}</div><div class="tile-lab">🔧 Механиков</div></div>
      <div class="tile"><div class="tile-val">${S.c.trains}</div><div class="tile-lab">🎓 Обучений всего</div></div>
    </div>
    ${(() => {
      const mechs = S.staff.filter((s) => s.role === 'mechanic');
      const passive = S.staff.filter((s) => s.role !== 'mechanic');
      let html = `
        <div class="section-h"><h2>🔧 Механики</h2><span class="sub">чинят машины клиентов в боксах</span></div>
        ${mechs.length ? `<div class="grid-auto">${mechs.map(staffCard).join('')}</div>`
          : '<div class="empty-note"><div class="en-ico">🧰</div>Ни одного механика — ремонты стоят! Наймите кого-нибудь ниже.</div>'}`;
      if (passive.length) {
        html += `
          <div class="section-h"><h2>🏢 Сервис и офис</h2><span class="sub">работают сами: пассивный доход и бонусы компании</span></div>
          <div class="grid-auto">${passive.map(staffCard).join('')}</div>`;
      }
      return html;
    })()}
    <div class="section-h">
      <h2>📋 Кандидаты</h2>
      <button class="btn small" data-act="stRefresh">🔄 Новые кандидаты <span class="price">$50</span></button>
    </div>
    <div class="grid-auto mb12">${S.applicants.map(appCard).join('') || '<div class="empty-note">Сегодня заявок больше нет — обновите список</div>'}</div>
    <div class="card small muted">
      💡 Механики чинят машины: следите за <b>усталостью</b> (медленнее работают) и <b>настроением</b> (могут уволиться).
      Администраторы, менеджеры, бухгалтеры и другие роли дают пассивные бонусы — они появляются после постройки нужных зданий.
    </div>
  `;
};

Object.assign(AST.actions, {
  stHire(d) { if (AST.staffM.hire(d.id)) AST.ui.render('staff'); },
  async stFire(d) {
    const st = AST.state.staff.find((s) => s.id === d.id);
    if (!st) return;
    const ok = await AST.modal.confirm('Уволить сотрудника?',
      `<b>${AST.u.esc(st.name)}</b> получит выходное пособие ${AST.u.fmt(st.salary * 3)}. Команда немного расстроится.`);
    if (ok && AST.staffM.fire(d.id)) AST.ui.render('staff');
  },
  stTrain(d) { if (AST.staffM.train(d.id)) AST.ui.render('staff'); },
  stVac(d) { if (AST.staffM.vacation(d.id)) AST.ui.render('staff'); },
  stRaise(d) { if (AST.staffM.raise(d.id)) AST.ui.render('staff'); },
  stRefresh() {
    if (!AST.econ.trySpend(50, 'staff', 'Объявление о вакансиях')) return;
    AST.staffM.refreshApplicants(true);
    AST.ui.render('staff');
  },
});

/* ============================================================
   СКЛАД
   ============================================================ */
const stockState = { sup: 'gar', cat: 'all', search: '', cart: {} };

/* Базовый набор расходников для старта (пока нет своей статистики) */
const STARTER_PARTS = ['oil', 'oil_filter', 'air_filter', 'cabin_filter', 'brake_pads', 'brake_pads_r', 'spark_plugs', 'coolant', 'brake_fluid', 'bulb_kit', 'wiper_blades', 'stab_link', 'tie_rod_end', 'valve_kit'];

/** Сколько таких деталей уже едет в заказах */
function inTransit(pid) {
  let n = 0;
  for (const o of AST.state.orders) n += o.items[pid] || 0;
  return n;
}

/**
 * Рекомендации закупок — привязаны к реальному обороту игрока:
 * 1) детали, которых прямо сейчас ждут ремонты в боксах;
 * 2) ходовые: игра считает расход в день и держит запас на ~2.5 дня;
 * 3) стартовый набор расходников, пока статистики нет.
 * Заказанное «в пути» считается запасом — дубли не предлагаются.
 */
function stockRecos() {
  const S = AST.state;
  const day = Math.max(1, S.time.day);
  const recos = [];
  const add = (pid, why, need) => {
    if (!AST.data.partById[pid]) return;
    if (recos.some((r) => r.pid === pid)) return;
    recos.push({ pid, why, need: Math.max(1, need) });
  };
  // 1) машина стоит и ждёт (и ничего не едет)
  for (const j of S.jobs) {
    if (j.waiting && j.waiting.pid && AST.inv.qty(j.waiting.pid) + inTransit(j.waiting.pid) <= 0) {
      add(j.waiting.pid, 'urgent', 1);
    }
  }
  // 2) ходовые: целевой запас = расход/день × 2.5 дня
  Object.entries(S.partUse || {})
    .sort((a, b) => b[1] - a[1])
    .forEach(([pid, cnt]) => {
      if (recos.length >= 12 || cnt < 2) return;
      const target = AST.u.clamp(Math.ceil((cnt / day) * 2.5) + 1, 2, 10);
      const have = AST.inv.qty(pid) + inTransit(pid);
      if (have < Math.max(1, Math.ceil(target / 2))) add(pid, 'hot', target - have);
    });
  // 3) старт без статистики
  if (recos.length < 6) {
    for (const pid of STARTER_PARTS) {
      if (recos.length >= 12) break;
      if (AST.inv.qty(pid) + inTransit(pid) <= 1) add(pid, 'starter', 2);
    }
  }
  return recos.slice(0, 12);
}

AST.panels.stock = function (root) {
  const S = AST.state;
  // выбранный поставщик хранится в сохранении
  if (S.flags.supplier && AST.data.supById[S.flags.supplier]) stockState.sup = S.flags.supplier;
  const total = AST.inv.totalQty();
  const cap = AST.inv.capacity();

  /* поставщики */
  let supHtml = '';
  for (const sup of AST.data.suppliers) {
    const locked = S.rep < sup.rep;
    const rel = S.supRel[sup.id] || 0;
    const disc = AST.SUPPLIER_DISCOUNT(rel);
    supHtml += `
      <div class="card hover ${stockState.sup === sup.id ? 'sel' : ''}" ${locked ? 'style="opacity:.55"' : `data-act="stockSup" data-sup="${sup.id}"`} >
        <div class="card-title">${sup.ico} ${AST.u.esc(sup.name)} ${locked ? `<span class="pill red">🔒 реп. ${sup.rep}</span>` : (stockState.sup === sup.id ? '<span class="pill acc">выбран</span>' : '')}</div>
        <div class="card-sub">${AST.u.esc(sup.desc)}</div>
        <div class="row wrap mt8 small">
          <span class="pill grey">💰 цены ×${sup.priceMult}</span>
          <span class="pill grey">🚚 ${sup.deliveryH} ч</span>
          <span class="pill grey">${'⭐'.repeat(sup.quality)}</span>
          ${disc > 0 ? `<span class="pill green">скидка ${Math.round(disc * 100)}%</span>` : ''}
        </div>
        <div class="small accent mt8">🎁 ${AST.u.esc(sup.perk)}</div>
      </div>`;
  }

  /* фильтры */
  const cats = [['all', '📋 Все']].concat(Object.keys(AST.data.partCats).map((c) => [c, AST.data.partCats[c].ico + ' ' + AST.data.partCats[c].name]));
  const catChips = cats.map(([id, label]) =>
    `<button class="subtab ${stockState.cat === id ? 'active' : ''}" data-act="stockCat" data-cat="${id}">${label}</button>`).join('');

  /* рекомендации закупок */
  const recos = stockRecos();
  const whyPill = { urgent: '<span class="pill red">🔴 ждут в боксе</span>', hot: '<span class="pill amber">🔥 ходовая</span>', starter: '<span class="pill grey">📦 базовый запас</span>' };
  let recoHtml = '';
  if (recos.length) {
    const chips = recos.map((r) => {
      const p = AST.data.partById[r.pid];
      const transit = inTransit(r.pid);
      return `<div class="list-item" style="padding:7px 10px">
        <div class="flex1 small"><b>${AST.u.esc(p.name)}</b> · склад: ${AST.inv.qty(r.pid)}${transit ? ` <span class="accent">(+${transit} 🚚 едет)</span>` : ''} ${whyPill[r.why]}</div>
        <button class="btn tiny" data-act="cartAdd" data-pid="${r.pid}" data-n="${r.need}">+${r.need} 🛒</button>
      </div>`;
    }).join('');
    recoHtml = `
      <div class="section-h"><h2>💡 Что заказать</h2>
        <button class="btn small primary" data-act="recoAdd">➕ Всё в корзину</button>
      </div>
      <div class="card mb12">
        <div class="small muted mb8">Игра считает расход каждой детали в ваших ремонтах. Здесь — то, что скоро понадобится:
        🔴 машина уже ждёт эту деталь, 🔥 часто расходуется и заканчивается, 📦 ходовые расходники для старта.
        Если детали нет на складе — курьер привезёт её с наценкой +60%, это съедает прибыль.</div>
        <div class="grid2" style="gap:8px">${chips}</div>
      </div>`;
  }

  /* таблица деталей (ходовые — сверху) */
  const q = stockState.search.toLowerCase();
  const parts = AST.data.parts
    .filter((p) =>
      (stockState.cat === 'all' || p.cat === stockState.cat) &&
      (!q || p.name.toLowerCase().includes(q)))
    .slice()
    .sort((a, b) => (S.partUse[b.id] || 0) - (S.partUse[a.id] || 0));
  let rows = '';
  for (const p of parts) {
    const have = AST.inv.qty(p.id);
    const inCart = stockState.cart[p.id] || 0;
    const price = AST.inv.price(p.id, stockState.sup);
    const used = S.partUse[p.id] || 0;
    rows += `
      <tr>
        <td>${AST.data.partCats[p.cat].ico} ${AST.u.esc(p.name)}</td>
        <td class="tac"><b class="${have === 0 ? 'bad' : ''}">${have}</b></td>
        <td class="tac">${used > 0 ? `<span class="${used >= 3 && have <= 2 ? 'warn-c' : 'muted'}">${used}×</span>` : '<span class="dim">—</span>'}</td>
        <td class="nowrap">${AST.u.fmt(price)}</td>
        <td class="nowrap">
          <button class="btn tiny" data-act="cartAdd" data-pid="${p.id}" data-n="1">+1</button>
          <button class="btn tiny" data-act="cartAdd" data-pid="${p.id}" data-n="5">+5</button>
          ${inCart ? `<span class="pill acc">${inCart} 🛒</span>` : ''}
        </td>
        <td class="nowrap">${have > 0 ? `<button class="btn tiny ghost" data-act="sellPart" data-pid="${p.id}" title="Продать 1 шт за 50% цены">💸</button>` : ''}</td>
      </tr>`;
  }

  /* корзина + окупаемость */
  let cartCount = 0, cartCost = 0, cartRetail = 0;
  for (const pid in stockState.cart) {
    const p = AST.data.partById[pid];
    cartCount += stockState.cart[pid];
    cartCost += AST.inv.price(pid, stockState.sup) * stockState.cart[pid];
    if (p) cartRetail += p.price * S.inflation * AST.BAL.PARTS_MARKUP * stockState.cart[pid];
  }
  if (stockState.sup === 'imp' && cartCount >= 10) cartCost = Math.round(cartCost * 0.9);
  const cartMargin = Math.round(cartRetail - cartCost);

  /* заказы в пути */
  let ordersHtml = '';
  for (const o of S.orders) {
    const sup = AST.data.supById[o.supId];
    const pct = 100 - AST.u.clamp((o.etaMin / o.etaTotal) * 100, 0, 100);
    ordersHtml += `
      <div class="list-item">
        <div class="avatar sm">${sup.ico}</div>
        <div class="flex1">
          <div class="small"><b>${AST.u.esc(sup.name)}</b> • ${o.count} поз. • ${AST.u.fmt(o.cost)}</div>
          <div class="row mt8"><div class="bar flex1 bar-anim"><div class="bar-fill" style="width:${pct}%"></div></div><span class="small nowrap">🚚 ${AST.u.fmtDur(o.etaMin)}</span></div>
        </div>
      </div>`;
  }

  const autoOrder = AST.research.hasSp('autoorder');

  root.innerHTML = `
    <div class="grid4 mb12">
      <div class="tile"><div class="tile-val ${total >= cap ? 'bad' : ''}">${total} / ${cap}</div><div class="tile-lab">📦 Заполнение склада</div></div>
      <div class="tile"><div class="tile-val">${AST.u.fmt(AST.inv.totalValue())}</div><div class="tile-lab">💰 Стоимость запасов</div></div>
      <div class="tile"><div class="tile-val">${Object.keys(S.inv).length}</div><div class="tile-lab">🔩 Видов деталей</div></div>
      <div class="tile"><div class="tile-val">${S.orders.length}</div><div class="tile-lab">🚚 Заказов в пути</div></div>
    </div>

    ${ordersHtml ? `<div class="section-h"><h2>🚚 Заказы в пути</h2></div><div class="list mb12">${ordersHtml}</div>` : ''}

    <div class="section-h"><h2>🏬 Поставщики</h2><span class="sub">выберите, у кого заказывать</span></div>
    <div class="grid-auto mb12">${supHtml}</div>
    ${autoOrder ? (S.flags.autoOrderOff
      ? `<div class="event-banner mb12" style="opacity:.75">🤖 Автозаказ выключен — недостающие детали поедут срочным курьером с наценкой +60%
          <button class="btn tiny primary" data-act="autoOrderToggle">Включить</button></div>`
      : `<div class="event-banner mb12">🤖 Автозаказ активен: недостающие детали заказываются сами у
          <b>${AST.u.esc(AST.data.supById[S.flags.autoSupplier || 'reg'].name)}</b>
          <button class="btn tiny" data-act="autoSupNext">сменить</button>
          <button class="btn tiny ghost" data-act="autoOrderToggle">выключить</button></div>`) : ''}

    ${recoHtml}

    <div class="section-h"><h2>🔩 Каталог запчастей</h2>
      <input class="input" style="max-width:220px" placeholder="🔎 Поиск детали…" value="${AST.u.esc(stockState.search)}" data-inp="stockSearch">
    </div>
    <div class="subtabs">${catChips}</div>
    <div class="tbl-wrap mb12">
      <table class="tbl">
        <thead><tr><th>Деталь</th><th class="tac">Склад</th><th class="tac" title="Сколько раз деталь понадобилась в ремонтах">Расход</th><th>Цена</th><th>В корзину</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="tac muted">Ничего не найдено</td></tr>'}</tbody>
      </table>
    </div>

    <div class="card ${cartCount ? 'sel' : ''}" style="position:sticky;bottom:8px;z-index:5">
      <div class="spread wrap">
        <div>
          <b>🛒 Корзина:</b> ${cartCount} поз. • <b class="accent">${AST.u.fmt(cartCost)}</b>
          <span class="small muted">• доставка ~${AST.u.fmtDur(Math.max(20, AST.data.supById[stockState.sup].deliveryH * 60 * (1 - AST.mods().delivery)))}</span>
          ${cartCount ? `<div class="small" title="Детали идут в счёт клиенту по базовой цене ×${AST.BAL.PARTS_MARKUP} — где бы вы их ни купили. Дешёвый поставщик = больше наценка. А вот срочный курьер (+60%) съедает её почти в ноль">
            💰 В счетах клиентам уйдут за ≈ ${AST.u.fmt(Math.round(cartRetail))} —
            ваша наценка <b class="${cartMargin >= 0 ? 'good' : 'bad'}">${cartMargin >= 0 ? '+' : '−'}${AST.u.fmt(Math.abs(cartMargin))}</b>
          </div>` : ''}
        </div>
        <div class="row">
          <button class="btn small ghost" data-act="cartClear" ${cartCount ? '' : 'disabled'}>Очистить</button>
          <button class="btn small primary" data-act="cartOrder" ${cartCount ? '' : 'disabled'}>🚚 Заказать</button>
        </div>
      </div>
    </div>
  `;
};

Object.assign(AST.actions, {
  stockSup(d) {
    stockState.sup = d.sup;
    AST.state.flags.supplier = d.sup;   // запоминаем выбор в сохранении
    AST.audio.play('click');
    AST.ui.render('stock');
  },
  stockCat(d) { stockState.cat = d.cat; AST.ui.render('stock'); },
  cartAdd(d) {
    stockState.cart[d.pid] = (stockState.cart[d.pid] || 0) + Number(d.n);
    AST.audio.play('click');
    AST.ui.render('stock');
  },
  cartClear() { stockState.cart = {}; AST.ui.render('stock'); },
  recoAdd() {
    for (const r of stockRecos()) {
      stockState.cart[r.pid] = (stockState.cart[r.pid] || 0) + r.need;
    }
    AST.audio.play('click');
    AST.ui.render('stock');
  },
  cartOrder() {
    if (AST.inv.order(stockState.sup, stockState.cart)) {
      stockState.cart = {};
      AST.ui.render('stock');
    }
  },
  sellPart(d) { if (AST.inv.sell(d.pid, 1)) AST.ui.render('stock'); },
  autoSupNext() {
    const S = AST.state;
    const unlocked = AST.data.suppliers.filter((s) => S.rep >= s.rep).map((s) => s.id);
    const cur = S.flags.autoSupplier || 'reg';
    const idx = unlocked.indexOf(cur);
    S.flags.autoSupplier = unlocked[(idx + 1) % unlocked.length];
    AST.ui.render('stock');
  },
  autoOrderToggle() {
    AST.state.flags.autoOrderOff = !AST.state.flags.autoOrderOff;
    AST.audio.play('click');
    AST.ui.render('stock');
  },
});
AST.inputs.stockSearch = (v) => { stockState.search = v; AST.ui.render('stock', true); };

/* ============================================================
   УЛУЧШЕНИЯ
   ============================================================ */
const upState = { cat: 'marketing' };

AST.panels.upgrades = function (root) {
  const S = AST.state;
  const bought = Object.values(S.upgrades).reduce((a, b) => a + b, 0);

  const chips = Object.keys(AST.data.upgradeCats).map((c) =>
    `<button class="subtab ${upState.cat === c ? 'active' : ''}" data-act="upCat" data-cat="${c}">
      ${AST.data.upgradeCats[c].ico} ${AST.data.upgradeCats[c].name}</button>`).join('');

  /* суммарный эффект линейки на уровне lvl (для «сейчас → станет») */
  const totalEff = (u, lvl) => {
    if (lvl <= 0) return 'ничего';
    if (u.eff === 'mood') return `+${u.val * lvl} к настроению команды`;
    if (u.eff === 'stockCap') return `+${u.val * lvl} к складу`;
    if (u.eff === 'queueCap') return `+${u.val * lvl} к очереди`;
    if (u.eff === 'hoursLate' || u.eff === 'hoursEarly') return `+${u.val * lvl} ч к рабочему времени`;
    return `+${Math.round(u.val * lvl * 100)}% ${effName(u.eff)}`;
  };

  const list = AST.data.upgrades.filter((u) => u.cat === upState.cat);
  let cards = '';
  for (const u of list) {
    const lvl = S.upgrades[u.id] || 0;
    const locked = S.rep < u.rep;
    const cost = Math.round(u.cost * Math.pow(u.costMult, lvl) * S.inflation);
    const dots = [1, 2, 3].map((n) => `<div class="up-dot ${n <= lvl ? 'on' : ''}"></div>`).join('');
    const effText = u.eff === 'mood' ? `+${u.val} к настроению команды`
      : u.eff === 'stockCap' ? `+${u.val} к складу`
      : u.eff === 'queueCap' ? `+${u.val} к очереди`
      : (u.eff === 'hoursLate' || u.eff === 'hoursEarly') ? `+${u.val} ч к рабочему времени`
      : `+${Math.round(u.val * 100)}% (${effName(u.eff)})`;
    const buyTip = `Сейчас: ${totalEff(u, lvl)} → станет: ${totalEff(u, lvl + 1)}`;
    cards += `
      <div class="card up-card hover" ${locked ? 'style="opacity:.55"' : ''}>
        <div class="spread">
          <div class="card-title" style="font-size:13.5px">${AST.u.esc(u.name)}</div>
          <div class="up-lvl-dots">${dots}</div>
        </div>
        <div class="card-sub flex1">${AST.u.esc(u.desc)}</div>
        <div class="up-effect">${effText} за уровень${lvl > 0 ? ` • сейчас: ${totalEff(u, lvl)}` : ''}</div>
        ${locked
          ? `<span class="pill red">🔒 Репутация ${u.rep}</span>`
          : lvl >= u.maxLvl
            ? '<span class="pill gold tac">Максимум!</span>'
            : `<button class="btn ${lvl === 0 ? 'primary' : ''} small" data-act="upBuy" data-id="${u.id}" title="${AST.u.esc(buyTip)}">Купить ур.${lvl + 1} <span class="price">${AST.u.fmt(cost)}</span></button>`}
      </div>`;
  }

  root.innerHTML = `
    <div class="grid4 mb12">
      <div class="tile"><div class="tile-val">${bought} / ${AST.data.upgradesTotal}</div><div class="tile-lab">⭐ Куплено улучшений</div></div>
      <div class="tile"><div class="tile-val">+${Math.round(AST.mods().clients * 100)}%</div><div class="tile-lab">🚗 Бонус к потоку клиентов</div></div>
      <div class="tile"><div class="tile-val">+${Math.round(AST.mods().speed * 100)}%</div><div class="tile-lab">⚡ Бонус к скорости работ</div></div>
      <div class="tile"><div class="tile-val">+${Math.round(AST.mods().income * 100)}%</div><div class="tile-lab">💵 Бонус к доходу</div></div>
    </div>
    <div class="subtabs">${chips}</div>
    <div class="grid-auto mb12">${cards}</div>
  `;

  function effName(eff) {
    return {
      income: 'доход', clients: 'поток клиентов', speed: 'скорость работ', quality: 'качество',
      errReduce: 'меньше ошибок', partsCost: 'дешевле детали', xp: 'опыт', rep: 'репутация',
      patience: 'терпение клиентов', fatigueReduce: 'меньше усталости', rp: 'очки науки',
      diag: 'диагностика', delivery: 'доставка', trainCost: 'дешевле обучение', tips: 'чаевые',
    }[eff] || eff;
  }
};

Object.assign(AST.actions, {
  upCat(d) { upState.cat = d.cat; AST.ui.render('upgrades'); },
  upBuy(d) {
    const S = AST.state;
    const u = AST.data.upById[d.id];
    const lvl = S.upgrades[u.id] || 0;
    if (lvl >= u.maxLvl || S.rep < u.rep) return;
    const cost = Math.round(u.cost * Math.pow(u.costMult, lvl) * S.inflation);
    if (!AST.econ.trySpend(cost, u.cat === 'marketing' ? 'marketing' : 'equip', u.name)) return;
    S.upgrades[u.id] = lvl + 1;
    AST.addC('upgrades');
    AST._modsDirty = true;
    AST.audio.play('buy');
    AST.fx.ringAt();
    AST.ui.toast('⭐', `${u.name} — уровень ${lvl + 1}`, u.desc, 'ok');
    AST.ui.render('upgrades');
  },
});
