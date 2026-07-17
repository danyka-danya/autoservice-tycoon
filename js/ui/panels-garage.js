/* ============================================================
   UI: вкладка «Гараж» — сцена, боксы, территория, постройки, очередь
   ============================================================ */
'use strict';

AST.actions = AST.actions || {};
AST.inputs = AST.inputs || {};

AST.panels.garage = function (root) {
  const S = AST.state;
  const m = AST.mods();
  const freeMechs = AST.staffM.freeMechanics().length;
  const mechCount = S.staff.filter((s) => s.role === 'mechanic').length;

  /* --- сводные плитки --- */
  const tiles = `
    <div class="grid4 mb12">
      <div class="tile"><div class="tile-val">${S.queue.length} / ${AST.clients.queueCap()}</div><div class="tile-lab">🚗 Очередь клиентов</div></div>
      <div class="tile"><div class="tile-val">${S.jobs.length} / ${S.garage.bays.length}</div><div class="tile-lab">🏗️ Занято боксов</div></div>
      <div class="tile"><div class="tile-val">${freeMechs} / ${mechCount}</div><div class="tile-lab">🔧 Свободных механиков</div></div>
      <div class="tile"><div class="tile-val">${AST.clients.ratePerHour().toFixed(1)}/ч</div><div class="tile-lab">📈 Поток клиентов</div></div>
    </div>`;

  /* --- боксы --- */
  let baysHtml = '';
  S.garage.bays.forEach((bay, i) => {
    const job = S.jobs.find((j) => j.bayId === bay.id);
    const broken = bay.brokenUntil > S.time.abs;
    let status;
    if (broken) status = `<span class="pill red">🛠️ сломан ещё ${AST.u.fmtDur(bay.brokenUntil - S.time.abs)}</span>`;
    else if (job) {
      const carName = AST.data.carById[job.client.carId].name;
      status = `<span class="pill acc">${job.phase === 'diag' ? '🔍 диагностика' : '🔧 ремонт'}: ${AST.u.esc(carName)}</span>`;
    } else status = '<span class="pill green">свободен</span>';

    const liftBtn = bay.tier < 3
      ? `<button class="btn tiny" data-act="upLift" data-bay="${bay.id}" title="Скорость работ в этом боксе: ×${AST.BAL.LIFT_TIER_SPEED[bay.tier - 1]} → ×${AST.BAL.LIFT_TIER_SPEED[bay.tier]}">⬆️ Подъёмник ур.${bay.tier + 1} <span class="price">${AST.u.fmt(Math.round(AST.BAL.LIFT_TIER_COST[bay.tier] * S.inflation))}</span></button>`
      : '<span class="pill gold">⚙️ макс. подъёмник</span>';
    const sellBtn = S.garage.bays.length > 1 && !job
      ? `<button class="btn tiny ghost" data-act="sellBay" data-bay="${bay.id}">Продать</button>` : '';

    baysHtml += `
      <div class="card">
        <div class="spread"><div class="card-title">Бокс №${i + 1} <span class="pill grey">скорость ×${AST.BAL.LIFT_TIER_SPEED[bay.tier - 1]}</span></div></div>
        <div class="mt8">${status}</div>
        <div class="row wrap mt8">${liftBtn}${sellBtn}</div>
      </div>`;
  });

  const canBuy = AST.garage.canAddBay();
  baysHtml += `
    <div class="card tac" style="display:flex;flex-direction:column;justify-content:center;gap:8px">
      <div style="font-size:30px">➕</div>
      ${canBuy
        ? `<button class="btn primary" data-act="buyBay" title="+1 машина чинится одновременно (понадобится свободный механик)">Купить бокс <span class="price">${AST.u.fmt(AST.garage.nextBayCost())}</span></button>`
        : `<div class="muted small">Лимит: ${AST.garage.maxBays()} боксов.<br>Расширьте территорию или исследуйте «Оборудование»</div>`}
    </div>`;

  /* --- территория --- */
  const landCost = AST.garage.landCost();
  const landHtml = `
    <div class="card">
      <div class="spread wrap">
        <div>
          <div class="card-title">🗺️ Территория — уровень ${S.garage.land + 1}</div>
          <div class="card-sub">Максимум боксов: ${AST.garage.maxBays()} • построек: ${AST.garage.facCount()}/${AST.garage.facCap()}</div>
        </div>
        ${landCost != null
          ? `<button class="btn gold" data-act="buyLand" title="Лимит боксов: ${AST.garage.maxBays()} → ${AST.garage.maxBays() + (AST.BAL.LAND_CAP[S.garage.land + 1] - AST.BAL.LAND_CAP[S.garage.land])}, площадок под постройки: ${AST.garage.facCap()} → ${AST.BAL.LAND_FAC_CAP[S.garage.land + 1]}">Расширить <span class="price">${AST.u.fmt(landCost)}</span></button>`
          : '<span class="pill gold">Максимальный размер!</span>'}
      </div>
    </div>`;

  /* --- постройки --- */

  /** Человеческое описание эффекта постройки на уровне lvl */
  const facEffText = (f, lvl) => {
    if (!f.eff || lvl <= 0) return null;
    const tot = f.eff.val * lvl;
    switch (f.eff.key) {
      case 'queueCap': return `+${tot} мест в очереди`;
      case 'patience': return `+${Math.round(tot * 100)}% к терпению клиентов`;
      case 'stockCap': return `+${tot} к вместимости склада`;
      case 'diag': return `+${Math.round(tot * 100)}% к скорости диагностики`;
      case 'rpDay': return `+${tot} 🔬 в день`;
      default: return null;
    }
  };

  /** Подсказка «что изменится» при покупке следующего уровня */
  const facNextTip = (f, lvl) => {
    const parts = [];
    if (f.income) {
      const cur = lvl > 0 ? Math.round(f.income[lvl - 1] * S.inflation) : 0;
      const next = Math.round(f.income[lvl] * S.inflation);
      parts.push(`Доход: ${cur ? AST.u.fmt(cur) : '$0'}/час → ${AST.u.fmt(next)}/час`);
      if (f.staff) parts.push(`${AST.data.roles[f.staff].name} удваивает доход`);
    }
    if (f.eff) {
      parts.push(`${facEffText(f, lvl) || 'сейчас: ничего'} → ${facEffText(f, lvl + 1)}`);
    }
    return parts.join('. ');
  };

  const facFull = AST.garage.facCount() >= AST.garage.facCap();
  const facCard = (f) => {
    const lvl = AST.garage.facLevel(f.id);
    const dots = [1, 2, 3].map((n) => `<div class="up-dot ${n <= lvl ? 'on' : ''}"></div>`).join('');
    const nextCost = lvl < 3 ? Math.round(f.costs[lvl] * S.inflation) : null;
    const blocked = lvl === 0 && facFull;   // новая постройка, а площадок нет
    const staffNote = f.staff && lvl > 0 && !S.staff.some((s) => s.role === f.staff)
      ? `<div class="small warn-c mt8">⚠️ Наймите: ${AST.data.roles[f.staff].name} — доход вырастет вдвое</div>` : '';
    const effNow = facEffText(f, lvl);
    return `
      <div class="card up-card hover">
        <div class="spread">
          <div class="card-title">${f.ico} ${AST.u.esc(f.name)}</div>
          <div class="up-lvl-dots">${dots}</div>
        </div>
        <div class="card-sub flex1">${AST.u.esc(f.desc)}</div>
        ${f.income && lvl > 0 ? `<div class="up-effect">≈ ${AST.u.fmt(AST.garage.facGainPerHour(f))}/час в рабочее время</div>` : ''}
        ${effNow ? `<div class="up-effect">Сейчас: ${effNow}</div>` : ''}
        ${staffNote}
        ${nextCost == null
          ? '<span class="pill gold tac">Максимальный уровень</span>'
          : blocked
            ? `<div class="small warn-c" title="Новые постройки требуют свободную площадку. Улучшать уже построенное можно всегда">🔒 Все площадки заняты (${AST.garage.facCount()}/${AST.garage.facCap()}) — расширьте территорию ${AST.garage.landCost() != null ? 'за ' + AST.u.fmt(AST.garage.landCost()) : ''}</div>`
            : `<button class="btn ${lvl === 0 ? 'primary' : ''} small" data-act="buyFac" data-fac="${f.id}" title="${AST.u.esc(facNextTip(f, lvl))}">${lvl === 0 ? 'Построить' : 'Улучшить'} <span class="price">${AST.u.fmt(nextCost)}</span></button>`}
      </div>`;
  };
  const incomeFacs = AST.data.facilities.filter((f) => f.income);
  const infraFacs = AST.data.facilities.filter((f) => !f.income);
  const facIncomeHtml = incomeFacs.map(facCard).join('');
  const facInfraHtml = infraFacs.map(facCard).join('');

  /* --- контракты --- */
  let contractHtml = '';
  const co = S.contractOffer;
  const ca = S.contract;
  if (co) {
    const ctr = AST.data.contractors.find((x) => x.id === co.contractor);
    const clsInfo = AST.data.carClasses[co.cls];
    contractHtml = `
      <div class="section-h"><h2>📜 Деловое предложение</h2><span class="sub">действует до конца дня</span></div>
      <div class="card sel mb12">
        <div class="card-title">${ctr.ico} ${AST.u.esc(ctr.name)}</div>
        <div class="card-sub mt8">Обслужите <b>${co.cars} ${AST.u.plural(co.cars, 'машину', 'машины', 'машин')}</b>
          (${clsInfo.ico} ${clsInfo.name}) за <b>${co.days} ${AST.u.plural(co.days, 'день', 'дня', 'дней')}</b>.</div>
        <div class="row wrap mt8 small">
          <span class="pill green">💵 Оплата: ${AST.u.fmt(co.pay)}</span>
          <span class="pill acc">аванс сразу: ${AST.u.fmt(co.advance)}</span>
          <span class="pill red">штраф за срыв: ${AST.u.fmt(co.penalty)}</span>
        </div>
        <div class="row mt8">
          <button class="btn primary small" data-act="ctrAccept" title="Аванс ${AST.u.fmt(co.advance)} сразу, остаток — когда все машины будут готовы. Машины будут приезжать сами, терпеливые. Не успеете к дедлайну — штраф и удар по репутации">🤝 Принять контракт</button>
          <button class="btn small ghost" data-act="ctrDecline">Отказаться</button>
        </div>
      </div>`;
  } else if (ca) {
    const ctr = AST.data.contractors.find((x) => x.id === ca.contractor);
    const daysLeft = ca.deadlineDay - S.time.day;
    contractHtml = `
      <div class="section-h"><h2>📜 Контракт в работе</h2></div>
      <div class="card mb12 ${daysLeft <= 0 ? 'sel' : ''}">
        <div class="spread wrap">
          <div class="card-title">${ctr.ico} ${AST.u.esc(ctr.name)}</div>
          <span class="pill ${daysLeft > 1 ? 'green' : 'red'}">⏳ ${daysLeft > 0 ? `${daysLeft} ${AST.u.plural(daysLeft, 'день', 'дня', 'дней')}` : 'сегодня дедлайн!'}</span>
        </div>
        <div class="row mt8">
          <div class="bar flex1 thick ${ca.done / ca.cars > 0.6 ? 'green' : ''}"><div class="bar-fill" style="width:${(ca.done / ca.cars) * 100}%"></div></div>
          <b class="nowrap">${ca.done} / ${ca.cars}</b>
        </div>
        <div class="small muted mt8">По завершении: <b class="good">+${AST.u.fmt(ca.pay - ca.advance)}</b> • при срыве: <b class="bad">−${AST.u.fmt(ca.penalty)}</b></div>
      </div>`;
  }

  /* --- очередь --- */
  let queueHtml = '';
  if (!S.queue.length) {
    queueHtml = '<div class="empty-note"><div class="en-ico">🍃</div>Очередь пуста — клиенты приедут сами.<br>Репутация и маркетинг ускоряют поток.</div>';
  } else {
    for (const c of S.queue) {
      const car = AST.data.carById[c.carId];
      const cls = AST.data.carClasses[car.cls];
      const pers = AST.clients.persOf(c);
      const left = Math.max(0, c.patience - c.waitedMin);
      const pct = AST.u.clamp((left / c.patience) * 100, 0, 100);
      const barCls = pct > 50 ? 'green' : pct > 22 ? 'amber' : 'red';
      queueHtml += `
        <div class="list-item">
          <div class="avatar">${c.emoji}</div>
          <div class="flex1">
            <div class="row wrap gap4">
              <b>${AST.u.esc(c.name)}</b>
              ${c.vip ? '<span class="pill gold">👑 VIP</span>' : ''}
              ${c.contract ? '<span class="pill acc">📜 контракт</span>' : ''}
              ${c.regular ? `<span class="pill green" title="Постоянный клиент: терпеливее, чаще оставляет чаевые. Разочаруете — уйдёт навсегда">⭐ постоянный</span>` : ''}
              <span class="pill grey">${pers.ico} ${pers.name}</span>
            </div>
            <div class="small muted ellip">${AST.u.esc(car.name)} • <span style="color:${cls.color}">${cls.name}</span> • ${AST.u.fmtN(c.mileage)} км • жалоб: ${c.faults.filter((f) => !f.hidden).length}</div>
            <div class="row mt8"><div class="bar ${barCls} flex1"><div class="bar-fill" style="width:${pct}%"></div></div><span class="small nowrap">⏳ ${AST.u.fmtDur(left)}</span></div>
          </div>
        </div>`;
    }
  }

  /* Сцена живёт отдельно от остального содержимого вкладки:
     при перерисовке панели она НЕ пересоздаётся (иначе машинки мерцают). */
  let rest = root.querySelector('#garage-rest');
  if (!rest) {
    root.innerHTML = '<div id="scene"></div><div id="garage-rest" class="mt12"></div>';
    rest = root.querySelector('#garage-rest');
    AST.scene.mount();
  }

  rest.innerHTML = `
    ${tiles}
    ${contractHtml}
    <div class="section-h"><h2>🏗️ Ремонтные боксы</h2><span class="sub">${S.garage.bays.length} из ${AST.garage.maxBays()}</span></div>
    <div class="grid-auto">${baysHtml}</div>
    <div class="section-h"><h2>🗺️ Территория</h2></div>
    ${landHtml}
    <div class="section-h"><h2>💰 Доходные сервисы</h2><span class="sub">${AST.garage.passivePerHour() > 0 ? `💤 пассивно ≈ <b class="good">${AST.u.fmt(AST.garage.passivePerHour())}/час</b> • ` : ''}зарабатывают сами в рабочие часы</span></div>
    <div class="grid-auto">${facIncomeHtml}</div>
    <div class="section-h"><h2>🛠️ Инфраструктура</h2><span class="sub">${AST.garage.facCount()} из ${AST.garage.facCap()} площадок занято • постоянные бонусы сервису</span></div>
    <div class="grid-auto">${facInfraHtml}</div>
    <div class="section-h"><h2>🚗 Очередь клиентов</h2></div>
    <div class="list mb12">${queueHtml}</div>
  `;
};

/* ---------- Действия гаража ---------- */
Object.assign(AST.actions, {
  buyBay() { if (AST.garage.buyBay()) AST.ui.render('garage'); },
  upLift(d) { if (AST.garage.upgradeLift(d.bay)) AST.ui.render('garage'); },
  async sellBay(d) {
    const ok = await AST.modal.confirm('Продать бокс?', 'Вы получите примерно 45% стоимости нового бокса. Продолжить?');
    if (ok && AST.garage.sellBay(d.bay)) AST.ui.render('garage');
  },
  buyLand() { if (AST.garage.buyLand()) AST.ui.render('garage'); },
  buyFac(d) { if (AST.garage.buyFacility(d.fac)) AST.ui.render('garage'); },
  ctrAccept() { if (AST.contracts.accept()) AST.ui.render('garage'); },
  async ctrDecline() {
    const ok = await AST.modal.confirm('Отказаться от контракта?', 'Предложение исчезнет. Следующее появится через несколько дней.');
    if (ok) { AST.contracts.decline(); AST.ui.render('garage'); }
  },
});
