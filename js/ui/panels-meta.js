/* ============================================================
   UI: вкладки «Наука», «Финансы», «Миссии», «Статистика», «Настройки»
   ============================================================ */
'use strict';

AST.actions = AST.actions || {};
AST.inputs = AST.inputs || {};

/* ============================================================
   НАУКА (исследования + навыки владельца)
   ============================================================ */
AST.panels.research = function (root) {
  const S = AST.state;
  const cur = S.research.cur;
  const curR = cur ? AST.data.researchById[cur.id] : null;
  const doneCount = Object.keys(S.research.done).length;

  let curHtml = '';
  if (curR) {
    const pct = 100 - AST.u.clamp((cur.leftH / cur.totalH) * 100, 0, 100);
    curHtml = `
      <div class="card sel mb12">
        <div class="spread wrap">
          <div class="card-title">🧪 Исследуется: ${AST.u.esc(curR.name)}</div>
          <span class="small muted">осталось ${AST.u.fmtDur(cur.leftH * 60)}</span>
        </div>
        <div class="bar bar-anim mt8"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  /* навыки владельца */
  const skTotal = (sk, l) => l <= 0 ? 'ничего'
    : sk.eff === 'mood' ? `+${sk.val * l} к настроению`
    : `+${parseFloat((sk.val * l * 100).toFixed(1))}%`;
  let skillsHtml = '';
  for (const sk of AST.data.ownerSkills) {
    const lvl = AST.research.skillLvl(sk.id);
    const skTip = `${sk.desc}. Сейчас: ${skTotal(sk, lvl)} → станет: ${skTotal(sk, lvl + 1)}`;
    skillsHtml += `
      <div class="skill-row" title="${AST.u.esc(skTip)}">
        <div class="avatar sm">${sk.ico}</div>
        <div class="flex1">
          <div class="small"><b>${sk.name}</b> <span class="muted">• ${lvl}/10${lvl > 0 ? ` • сейчас ${skTotal(sk, lvl)}` : ''}</span></div>
          <div class="small dim">${AST.u.esc(sk.desc)}</div>
        </div>
        ${lvl < 10 ? `<button class="btn tiny ${S.skillPts > 0 ? 'primary' : ''}" data-act="skillUp" data-id="${sk.id}" ${S.skillPts > 0 ? '' : 'disabled'}>+1</button>` : '<span class="pill gold">МАКС</span>'}
      </div>`;
  }

  /* подробности для подсказок */
  const EFF_NAMES = {
    speed: 'Скорость работ', errReduce: 'Снижение ошибок', quality: 'Качество ремонта',
    partsCost: 'Скидка на запчасти', income: 'Доход', diag: 'Скорость диагностики',
    clients: 'Поток клиентов', utilities: 'Экономия на аренде и коммуналке',
    stockCap: 'Вместимость склада', delivery: 'Скорость доставки', hireQ: 'Уровень кандидатов',
    xp: 'Опыт сотрудников', trainCost: 'Скидка на обучение', mood: 'Настроение команды',
    fatigueReduce: 'Снижение усталости', rep: 'Рост репутации', rpDay: 'Очков науки в день',
    rp: 'Очки науки за работу', patience: 'Терпение клиентов', evSpeed: 'Скорость EV-работ',
  };
  const fmtEffVal = (key, v) => ['rpDay', 'stockCap', 'mood'].includes(key) ? `+${Math.round(v)}` : `+${Math.round(v * 100)}%`;

  const spDetail = (r) => {
    const m = AST.mods();
    switch (r.sp) {
      case 'ev': return 'К вам начнут приезжать электромобили: 6 моделей, 9 видов дорогих работ (класс EV платит ×2 от эконома). Дальше по ветке — ускорение EV-работ';
      case 'bays2': return `Лимит ремонтных боксов: ${AST.garage.maxBays()} → ${AST.garage.maxBays() + 2} (сейчас построено ${S.garage.bays.length})`;
      case 'staff2': return `Лимит сотрудников: ${AST.staffM.staffCap()} → ${AST.staffM.staffCap() + 2} (сейчас в штате ${S.staff.length})`;
      case 'autoorder': return 'Недостающие детали будут заказываться сами у выбранного поставщика — дорогие срочные доставки (+60%) уйдут в прошлое';
      case 'vip': return 'Клиенты бизнес-класса и выше иногда приезжают как VIP: платят ×1.8, но терпения у них меньше';
      case 'hidden': return 'Диагностика начнёт находить скрытые неисправности примерно у трети машин — дополнительная оплачиваемая работа с каждого такого клиента';
      case 'solar': return 'Коммунальные платежи станут в 2 раза меньше — навсегда';
      case 'sprinkler': return 'Событие «задымление на складе» больше никогда не случится, а пожарная инспекция будет хвалить (+репутация)';
      case 'security': return 'Кражи со склада больше никогда не случатся';
      case 'auction': return 'Начнут появляться события-аукционы: боксы со скидкой 40%';
      case 'franchise': return 'Во вкладке «Финансы» откроется сеть филиалов: каждый приносит пассивный доход каждый день, зависящий от вашей репутации';
      default: return r.desc;
    }
  };

  /* ветки исследований */
  let branchesHtml = '';
  for (const br in AST.data.researchBranches) {
    const info = AST.data.researchBranches[br];
    const nodes = AST.data.research.filter((r) => r.br === br);
    let nodesHtml = '';
    nodes.forEach((r, i) => {
      const done = AST.research.isDone(r.id);
      const isCur = cur && cur.id === r.id;
      const reqOk = !r.req || AST.research.isDone(r.req);
      const cls = done ? 'done' : isCur ? 'cur' : reqOk ? '' : 'locked';
      // подробная подсказка
      let tip = `Шаг ${i + 1} из ${nodes.length} ветки «${info.name}». `;
      if (r.sp) {
        tip += spDetail(r);
      } else if (r.eff) {
        const curVal = AST.mods()[r.eff.key] || 0;
        tip += `${EFF_NAMES[r.eff.key] || r.eff.key}: сейчас у вас ${fmtEffVal(r.eff.key, curVal)} → станет ${fmtEffVal(r.eff.key, curVal + r.eff.val)}`;
      } else {
        tip += r.desc;
      }
      if (!done && nodes[i + 1]) tip += `. Дальше откроется: «${nodes[i + 1].name}»`;
      nodesHtml += `
        <div class="re-node ${cls}" title="${AST.u.esc(tip)}">
          <div class="re-name">${done ? '✅ ' : isCur ? '🧪 ' : r.sp ? '✨ ' : ''}${AST.u.esc(r.name)}</div>
          <div class="re-desc">${AST.u.esc(r.desc)}</div>
          ${done ? '' : isCur ? '<div class="re-cost accent">Идёт исследование…</div>' : `
            <div class="re-cost"><span>🔬 ${r.rp}</span><span>💵 ${AST.u.fmt(r.money)}</span><span>⏱️ ${r.hours} ч</span></div>
            ${reqOk ? `<button class="btn tiny primary mt8" data-act="reStart" data-id="${r.id}" ${S.research.cur ? 'disabled' : ''}>Исследовать</button>` : '<div class="small dim mt8">🔒 нужен предыдущий шаг</div>'}`}
        </div>`;
    });
    const doneBr = nodes.filter((r) => AST.research.isDone(r.id)).length;
    branchesHtml += `
      <div class="re-branch-h">${info.ico} ${info.name} <span class="pill grey">${doneBr}/${nodes.length}</span></div>
      <div class="re-nodes">${nodesHtml}</div>`;
  }

  root.innerHTML = `
    <div class="grid4 mb12">
      <div class="tile"><div class="tile-val">${Math.floor(S.rp)}</div><div class="tile-lab">🔬 Очки исследований</div></div>
      <div class="tile"><div class="tile-val">${doneCount} / 100</div><div class="tile-lab">🧪 Исследовано</div></div>
      <div class="tile"><div class="tile-val">${S.ownerLvl}</div><div class="tile-lab">👑 Уровень владельца</div></div>
      <div class="tile"><div class="tile-val ${S.skillPts > 0 ? 'accent' : ''}">${S.skillPts}</div><div class="tile-lab">✨ Очки навыков</div></div>
    </div>
    ${curHtml}
    <div class="section-h"><h2>👑 Навыки владельца</h2><span class="sub">очки дают уровни владельца</span></div>
    <div class="grid2 mb12" style="gap:8px">${skillsHtml}</div>
    <div class="section-h"><h2>🔬 Дерево технологий</h2><span class="sub">очки науки капают за каждый ремонт</span></div>
    ${branchesHtml}
    <div class="mb12"></div>
  `;
};

Object.assign(AST.actions, {
  reStart(d) { if (AST.research.start(d.id)) AST.ui.render('research'); },
  skillUp(d) { if (AST.research.spendSkill(d.id)) AST.ui.render('research'); },
});

/* ============================================================
   ФИНАНСЫ
   ============================================================ */
AST.panels.finance = function (root) {
  const S = AST.state;
  const hist = S.history;
  const yesterday = hist[hist.length - 1];
  const value = AST.econ.value();

  /* активные бусты */
  const boosts = AST.activeBoosts();
  let boostHtml = '';
  if (boosts.length) {
    boostHtml = '<div class="row wrap mb12">' + boosts.map((b) => {
      const left = AST.u.fmtDur(b.untilAbs - S.time.abs);
      const good = b.val > 0 && b.key !== 'blackout';
      return `<span class="pill ${good ? 'green' : 'red'}">${good ? '🔺' : '🔻'} ${AST.u.esc(b.label || b.key)} • ${left}</span>`;
    }).join('') + '</div>';
  }

  /* кредиты */
  let loansHtml = '';
  for (const l of S.loans) {
    loansHtml += `
      <div class="list-item">
        <div class="avatar sm">🏦</div>
        <div class="flex1 small"><b>${AST.u.esc(l.name)}</b> — платёж ${AST.u.fmt(l.dailyPay)}/день,
        осталось ${l.leftDays} ${AST.u.plural(l.leftDays, 'день', 'дня', 'дней')} (${AST.u.fmt(l.dailyPay * l.leftDays)})</div>
      </div>`;
  }
  let offersHtml = '';
  AST.econ.loanOffers().forEach((o, i) => {
    offersHtml += `
      <div class="card hover">
        <div class="card-title">${o.ico} ${o.name}</div>
        <div class="card-sub">Получите <b class="good">${AST.u.fmt(o.principal)}</b>, вернёте ${AST.u.fmt(Math.round(o.principal * o.rate))}
          за ${o.days} ${AST.u.plural(o.days, 'день', 'дня', 'дней')} (${AST.u.fmt(Math.ceil(o.principal * o.rate / o.days))}/день)</div>
        <button class="btn small mt8" data-act="loanTake" data-i="${i}">Взять кредит</button>
      </div>`;
  });

  /* франшизы */
  const frUnlocked = AST.research.hasSp('franchise');
  let frHtml = '';
  if (frUnlocked) {
    const list = S.franchises.map((f) => `
      <div class="list-item"><div class="avatar sm">🏪</div>
        <div class="flex1 small"><b>${AST.u.esc(f.city)}</b> — приносит ≈ ${AST.u.fmt(AST.econ.franchiseDaily(f))}/день</div></div>`).join('');
    frHtml = `
      ${list || '<div class="empty-note">Филиалов пока нет</div>'}
      <button class="btn gold mt8" data-act="frBuy">🏪 Открыть филиал <span class="price">${AST.u.fmt(AST.econ.franchiseCost())}</span></button>
      <div class="small muted mt8">Доход филиала зависит от репутации. Управляющий (роль) добавляет +25%.</div>`;
  } else {
    frHtml = '<div class="empty-note"><div class="en-ico">🔒</div>Исследуйте «Франшизную модель» в ветке Маркетинг,<br>чтобы строить сеть по всей стране</div>';
  }

  root.innerHTML = `
    <div class="grid4 mb12">
      <div class="tile"><div class="tile-val ${S.money < 0 ? 'bad' : 'good'}">${AST.u.fmt(S.money)}</div><div class="tile-lab">💵 Касса</div></div>
      <div class="tile"><div class="tile-val gold-c">${AST.u.fmt(value)}</div><div class="tile-lab">🏆 Стоимость компании</div></div>
      <div class="tile"><div class="tile-val ${yesterday && yesterday.profit < 0 ? 'bad' : ''}">${yesterday ? AST.u.fmt(yesterday.profit) : '—'}</div><div class="tile-lab">📊 Прибыль вчера</div></div>
      <div class="tile"><div class="tile-val">${AST.u.fmt(S.stats.bestDay || 0)}</div><div class="tile-lab">🥇 Лучший день</div></div>
    </div>
    ${boostHtml}

    ${(() => {
      const svcHour = AST.garage.passivePerHour();
      const frDay = AST.econ.franchiseDailyTotal();
      const depDay = Math.round(S.deposit * AST.BAL.DEPOSIT_RATE);
      if (svcHour + frDay + depDay <= 0) return '';
      const oh = AST.time.openHours();
      const totalDay = Math.round(svcHour * (oh.end - oh.start)) + frDay + depDay;
      return `<div class="card mb12" title="Деньги, которые капают сами: сервисы работают в рабочие часы, филиалы и депозит платят раз в день (в полночь)">
        <div class="spread wrap">
          <div class="card-title">💤 Пассивный доход</div>
          <b class="good">≈ ${AST.u.fmt(totalDay)}/день</b>
        </div>
        <div class="row wrap mt8 small">
          ${svcHour ? `<span class="pill green">🏢 Сервисы: ${AST.u.fmt(svcHour)}/час</span>` : ''}
          ${frDay ? `<span class="pill green">🏪 Филиалы: ${AST.u.fmt(frDay)}/день</span>` : ''}
          ${depDay ? `<span class="pill green">💎 Депозит: ${AST.u.fmt(depDay)}/день</span>` : ''}
        </div>
      </div>`;
    })()}

    <div class="grid2 mb12">
      <div class="card chart-box">
        <div class="card-title mb8">📈 Доходы и расходы, 30 дней</div>
        <canvas class="chart" id="fin-chart-line"></canvas>
        <div class="chart-legend">
          <span><span class="lg-dot" style="background:#3ddc84"></span>Доходы</span>
          <span><span class="lg-dot" style="background:#ff5d6c"></span>Расходы</span>
        </div>
      </div>
      <div class="card chart-box">
        <div class="card-title mb8">💰 Расходы сегодня</div>
        <canvas class="chart" id="fin-chart-exp"></canvas>
      </div>
    </div>

    <div class="section-h"><h2>🏦 Кредиты</h2><span class="sub">${S.loans.length}/3 активных</span></div>
    ${loansHtml ? `<div class="list mb12">${loansHtml}</div>` : ''}
    <div class="grid3 mb12">${offersHtml}</div>

    <div class="grid2 mb12">
      <div class="card">
        <div class="card-title">💎 Депозит — ${AST.u.fmt(S.deposit)}</div>
        <div class="card-sub">+${(AST.BAL.DEPOSIT_RATE * 100).toFixed(0)}% каждый день (${S.deposit > 0 ? '≈' + AST.u.fmt(Math.round(S.deposit * AST.BAL.DEPOSIT_RATE)) + '/день' : 'проценты капитализируются'}), забрать можно в любой момент</div>
        <div class="row wrap mt8">
          <button class="btn tiny" data-act="depAdd" data-v="1000">+ $1 000</button>
          <button class="btn tiny" data-act="depAdd" data-v="10000">+ $10K</button>
          <button class="btn tiny" data-act="depAdd" data-v="100000">+ $100K</button>
          <button class="btn tiny ghost" data-act="depTake" ${S.deposit > 0 ? '' : 'disabled'}>Забрать всё</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">🛡️ Страховка склада ${S.flags.insurance ? '<span class="pill green">активна</span>' : '<span class="pill grey">выкл</span>'}</div>
        <div class="card-sub">1% стоимости запасов в день. При пожаре или краже вернёт 80% ущерба.</div>
        <button class="btn small mt8 ${S.flags.insurance ? '' : 'primary'}" data-act="insToggle">${S.flags.insurance ? 'Отключить' : 'Подключить'}</button>
      </div>
    </div>

    <div class="section-h"><h2>🏪 Сеть филиалов</h2><span class="sub">${S.franchises.length} открыто</span></div>
    <div class="card mb12">${frHtml}</div>
  `;

  /* графики после вставки в DOM */
  requestAnimationFrame(() => {
    const lineC = AST.u.byId('fin-chart-line');
    if (lineC) {
      const last30 = hist.slice(-30);
      AST.charts.line(lineC, [
        { data: last30.map((d) => d.income), color: '#3ddc84' },
        { data: last30.map((d) => d.expenses), color: '#ff5d6c' },
      ], last30.map((d) => 'д.' + d.day));
    }
    const expC = AST.u.byId('fin-chart-exp');
    if (expC) {
      const colors = ['#ff5d6c', '#fbbf24', '#a78bfa', '#22d3ee', '#fb7185', '#34d399', '#8f98a8', '#e8b64e'];
      const data = Object.keys(S.ledger.exp)
        .map((k, i) => ({ label: AST.econ.EXP_CATS[k] || k, value: S.ledger.exp[k], color: colors[i % colors.length] }))
        .sort((a, b) => b.value - a.value).slice(0, 7);
      if (data.length) AST.charts.bars(expC, data);
    }
  });
};

Object.assign(AST.actions, {
  loanTake(d) {
    const offer = AST.econ.loanOffers()[Number(d.i)];
    if (offer && AST.econ.takeLoan(offer)) AST.ui.render('finance');
  },
  depAdd(d) { if (AST.econ.depositAdd(Number(d.v))) { AST.audio.play('cash'); AST.ui.render('finance'); } },
  depTake() { if (AST.econ.depositTake(AST.state.deposit)) { AST.audio.play('cash'); AST.ui.render('finance'); } },
  frBuy() { if (AST.econ.franchiseBuy()) AST.ui.render('finance'); },
  insToggle() {
    AST.state.flags.insurance = !AST.state.flags.insurance;
    AST.audio.play('click');
    AST.ui.render('finance');
  },
});

/* ============================================================
   МИССИИ / ЕЖЕДНЕВКИ / ДОСТИЖЕНИЯ
   ============================================================ */
const msState = { tab: 'missions', achFilter: 'all' };

AST.panels.missions = function (root) {
  const S = AST.state;
  const tabs = [
    ['missions', '🎯 Миссии'],
    ['daily', '📅 Ежедневные'],
    ['ach', `🏆 Достижения (${AST.ach.count()}/${AST.data.achievements.length})`],
  ].map(([id, label]) =>
    `<button class="subtab ${msState.tab === id ? 'active' : ''}" data-act="msTab" data-tab="${id}">${label}</button>`).join('');

  let body = '';

  if (msState.tab === 'missions') {
    const missionCard = (ms) => {
      const done = AST.missions.isDone(ms);
      const pct = Math.round(AST.missions.progress(ms) * 100);
      const goalsHtml = ms.goals.map((g) => {
        const cur = AST.missions.metric(g.m);
        return `<div class="mi-goal">
          <div class="bar flex1 ${done ? 'green' : ''}"><div class="bar-fill" style="width:${AST.u.clamp((cur / g.v) * 100, 0, 100)}%"></div></div>
          <span class="small nowrap">${AST.u.fmtN(Math.min(cur, g.v))} / ${AST.u.fmtN(g.v)}</span>
        </div>`;
      }).join('');
      return `
        <div class="card mission-card ${done ? 'claimable' : ''}">
          <div class="card-title">${ms.ico} ${AST.u.esc(ms.name)} ${ms.story ? '<span class="pill acc">сюжет</span>' : ''}</div>
          <div class="card-sub">${AST.u.esc(ms.desc)}</div>
          ${goalsHtml}
          <div class="spread">
            <div class="mi-reward">
              <span class="good">+${AST.u.fmt(ms.rw.money)}</span>
              <span class="accent">+${ms.rw.rp} 🔬</span>
              <span class="gold-c">+${ms.rw.xp} XP</span>
            </div>
            ${done ? `<button class="btn gold small shine" data-act="msClaim" data-id="${ms.id}">Забрать</button>` : `<span class="pill grey">${pct}%</span>`}
          </div>
        </div>`;
    };
    const story = AST.missions.visibleStory();
    const chains = AST.missions.visibleChains();
    const doneCount = Object.keys(S.missions.claimed).length;
    body = `
      <div class="card mb12 small muted">Выполнено миссий: <b class="accent">${doneCount} / ${AST.data.missions.length}</b>.
        Сюжетные миссии ведут от гаража к империи, серийные — награждают за всё, что вы и так делаете.</div>
      <div class="section-h"><h2>📖 Сюжет</h2></div>
      <div class="grid-auto mb12">${story.map(missionCard).join('') || '<div class="empty-note">🎉 Все сюжетные миссии выполнены! Империя построена.</div>'}</div>
      <div class="section-h"><h2>♾️ Направления</h2></div>
      <div class="grid-auto mb12">${chains.map(missionCard).join('')}</div>`;
  }

  if (msState.tab === 'daily') {
    const tasks = S.daily.tasks.map((t) => {
      const prog = AST.missions.dailyProgress(t);
      const done = AST.missions.dailyDone(t);
      const claimed = S.daily.claimed[t.id];
      return `
        <div class="card mission-card ${done && !claimed ? 'claimable' : ''} ${claimed ? 'done' : ''}">
          <div class="card-title">${t.ico} ${AST.u.esc(t.name)}</div>
          <div class="card-sub">${AST.u.esc(t.desc)}</div>
          <div class="mi-goal">
            <div class="bar flex1 ${done ? 'green' : ''}"><div class="bar-fill" style="width:${AST.u.clamp((prog / t.v) * 100, 0, 100)}%"></div></div>
            <span class="small nowrap">${AST.u.fmtN(Math.min(prog, t.v))} / ${AST.u.fmtN(t.v)}</span>
          </div>
          ${claimed ? '<span class="pill green">✅ получено</span>'
            : done ? `<button class="btn gold small" data-act="dlClaim" data-id="${t.id}">Забрать</button>`
            : ''}
        </div>`;
    }).join('');

    const chestReady = AST.missions.dailyChestReady();
    const streakIdx = (S.daily.streak - 1) % AST.data.streakRewards.length;
    const streakRow = AST.data.streakRewards.map((rw, i) => `
      <div class="streak-day ${i < streakIdx || (i === streakIdx && !AST.missions.streakClaimable()) ? 'got' : ''} ${i === streakIdx && AST.missions.streakClaimable() ? 'today' : ''}">
        <div class="sd-ico">${rw.ico}</div>
        <div>День ${i + 1}</div>
        <div class="dim">${rw.label}</div>
      </div>`).join('');

    body = `
      <div class="section-h"><h2>🔥 Серия входов: ${S.daily.streak} ${AST.u.plural(S.daily.streak, 'день', 'дня', 'дней')}</h2>
        ${AST.missions.streakClaimable() ? '<button class="btn gold small shine" data-act="streakClaim">Забрать награду дня</button>' : '<span class="sub">награда получена, ждём завтра</span>'}
      </div>
      <div class="streak-row mb12">${streakRow}</div>
      <div class="section-h"><h2>📅 Задания на сегодня</h2><span class="sub">обновляются каждый игровой день</span></div>
      <div class="grid3 mb12">${tasks || '<div class="empty-note">Задания появятся с началом нового дня</div>'}</div>
      <div class="card ${chestReady ? 'sel' : ''}">
        <div class="chest-box">
          <div class="chest-ico">🎁</div>
          <div class="flex1">
            <div class="card-title">Сундук дня</div>
            <div class="card-sub">Выполните все 3 задания и получите случайную награду</div>
          </div>
          ${chestReady ? '<button class="btn gold shine" data-act="dlChest">Открыть!</button>'
            : S.daily.chestClaimed ? '<span class="pill green">✅ открыт</span>' : '<span class="pill grey">🔒</span>'}
        </div>
      </div>`;
  }

  if (msState.tab === 'ach') {
    const filters = [['all', 'Все'], ['open', 'Открытые'], ['locked', 'Закрытые']].map(([id, label]) =>
      `<button class="subtab ${msState.achFilter === id ? 'active' : ''}" data-act="achFilter" data-f="${id}">${label}</button>`).join('');
    let grid = '';
    for (const a of AST.data.achievements) {
      const un = AST.ach.unlocked(a.id);
      if (msState.achFilter === 'open' && !un) continue;
      if (msState.achFilter === 'locked' && un) continue;
      grid += `
        <div class="ach ${un ? 'unlocked' : ''}" title="${AST.u.esc(a.desc)} • награда ${a.rwRp} 🔬">
          <div class="ach-ico">${a.ico}</div>
          <div class="ach-name">${AST.u.esc(a.name)}</div>
          <div class="ach-desc">${AST.u.esc(a.desc)}</div>
        </div>`;
    }
    body = `
      <div class="subtabs">${filters}</div>
      <div class="grid-auto-sm mb12">${grid || '<div class="empty-note">Пусто</div>'}</div>`;
  }

  root.innerHTML = `<div class="subtabs">${tabs}</div>${body}`;
};

Object.assign(AST.actions, {
  msTab(d) { msState.tab = d.tab; AST.ui.render('missions'); },
  achFilter(d) { msState.achFilter = d.f; AST.ui.render('missions'); },
  msClaim(d) { if (AST.missions.claim(d.id)) AST.ui.render('missions'); },
  dlClaim(d) { if (AST.missions.claimDaily(d.id)) AST.ui.render('missions'); },
  dlChest() { if (AST.missions.claimDailyChest()) AST.ui.render('missions'); },
  streakClaim() { if (AST.missions.claimStreak()) AST.ui.render('missions'); },
});

/* ============================================================
   СТАТИСТИКА / ЭНЦИКЛОПЕДИЯ / ЖУРНАЛ
   ============================================================ */
const statState = { tab: 'stats', search: '' };

AST.panels.stats = function (root) {
  const S = AST.state;
  const tabs = [
    ['stats', '📊 Показатели'],
    ['cars', '🚗 Автомобили'],
    ['faults', '🔧 Неисправности'],
    ['parts', '🔩 Запчасти'],
    ['log', '📜 Журнал'],
  ].map(([id, label]) =>
    `<button class="subtab ${statState.tab === id ? 'active' : ''}" data-act="statTab" data-tab="${id}">${label}</button>`).join('');

  let body = '';
  const q = statState.search.toLowerCase();
  const searchBox = `<input class="input mb12" style="width:100%;max-width:340px" placeholder="🔎 Поиск…" value="${AST.u.esc(statState.search)}" data-inp="statSearch">`;

  if (statState.tab === 'stats') {
    const rows = [
      ['🔧 Ремонтов выполнено', S.c.repairs], ['✨ Идеальных (5★)', S.c.perfect],
      ['🚗 Клиентов обслужено', S.c.clients], ['😠 Клиентов потеряно', S.c.lost],
      ['💵 Заработано всего', AST.u.fmt(S.c.income)], ['💸 Потрачено всего', AST.u.fmt(S.c.spent)],
      ['📦 Куплено деталей', S.c.partsBought], ['🔩 Израсходовано деталей', S.c.partsUsed],
      ['👥 Нанято сотрудников', S.c.hires], ['🎓 Обучений проведено', S.c.trains],
      ['⭐ Улучшений куплено', S.c.upgrades], ['🔬 Исследований', S.c.research],
      ['🎲 Событий пережито', S.c.events], ['🧽 Моек', S.c.washes],
      ['⭕ Услуг шиномонтажа', S.c.tireSvc], ['🔨 Кузовных работ', S.c.bodySvc],
      ['👑 VIP-клиентов', S.c.vip], ['🏪 Филиалов', S.c.franchises],
      ['🌟 Отзывов 5★', S.c.reviews5], ['💢 Отзывов 1★', S.c.reviews1],
      ['⚠️ Ошибок механиков', S.c.errors], ['💰 Чаевых получено', S.c.tips],
      ['🎁 Сундуков открыто', S.c.chests], ['📅 Дней в бизнесе', S.time.day],
    ];
    const classRows = Object.keys(AST.data.carClasses).map((cls) =>
      `<div class="tile"><div class="tile-val">${S.c['cls_' + cls] || 0}</div>
       <div class="tile-lab">${AST.data.carClasses[cls].ico} ${AST.data.carClasses[cls].name}</div></div>`).join('');
    body = `
      <div class="grid4 mb12">${rows.map(([l, v]) =>
        `<div class="tile"><div class="tile-val">${v}</div><div class="tile-lab">${l}</div></div>`).join('')}</div>
      <div class="section-h"><h2>🚘 Обслужено по классам</h2></div>
      <div class="grid4 mb12">${classRows}</div>
      <div class="card small muted">⏱️ Времени в игре: ${AST.u.fmtDur(S.meta.playMin)} • Пик стоимости компании: ${AST.u.fmt(S.stats.valuePeak || 0)}</div>`;
  }

  if (statState.tab === 'cars') {
    let rows = '';
    for (const car of AST.data.cars) {
      if (q && !car.name.toLowerCase().includes(q)) continue;
      const cls = AST.data.carClasses[car.cls];
      rows += `<tr>
        <td>${AST.u.esc(car.name)}</td>
        <td><span style="color:${cls.color}">${cls.ico} ${cls.name}</span></td>
        <td>${AST.u.fmt(car.value)}</td>
        <td>${'🔧'.repeat(car.complexity)}</td>
        <td>${car.engine}</td>
        <td class="small muted">${car.tags.join(', ') || '—'}</td>
      </tr>`;
    }
    body = `${searchBox}<div class="tbl-wrap mb12"><table class="tbl">
      <thead><tr><th>Модель (${AST.data.cars.length})</th><th>Класс</th><th>Цена авто</th><th>Сложность</th><th>Двигатель</th><th>Особенности</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  if (statState.tab === 'faults') {
    let rows = '';
    for (const f of AST.data.faults) {
      if (q && !f.name.toLowerCase().includes(q)) continue;
      const parts = f.parts.map((pid) => AST.data.partById[pid] ? AST.data.partById[pid].name : pid).join(', ');
      rows += `<tr>
        <td>${AST.data.faultCats[f.cat].ico} ${AST.u.esc(f.name)}</td>
        <td>${AST.u.fmt(f.labor)}</td>
        <td>${AST.u.fmtDur(f.dur)}</td>
        <td>${'●'.repeat(f.diff)}<span class="dim">${'○'.repeat(5 - f.diff)}</span></td>
        <td>навык ${f.minSkill}+</td>
        <td class="small muted">${AST.u.esc(parts) || '—'}</td>
      </tr>`;
    }
    body = `${searchBox}<div class="tbl-wrap mb12"><table class="tbl">
      <thead><tr><th>Работа (${AST.data.faults.length})</th><th>Цена работ</th><th>Время</th><th>Сложность</th><th>Требования</th><th>Детали</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  if (statState.tab === 'parts') {
    let rows = '';
    for (const p of AST.data.parts) {
      if (q && !p.name.toLowerCase().includes(q)) continue;
      rows += `<tr>
        <td>${AST.data.partCats[p.cat].ico} ${AST.u.esc(p.name)}</td>
        <td>${AST.data.partCats[p.cat].name}</td>
        <td>${AST.u.fmt(Math.round(p.price * S.inflation))}</td>
        <td class="tac"><b>${AST.inv.qty(p.id)}</b></td>
      </tr>`;
    }
    body = `${searchBox}<div class="tbl-wrap mb12"><table class="tbl">
      <thead><tr><th>Деталь (${AST.data.parts.length})</th><th>Категория</th><th>Базовая цена</th><th class="tac">На складе</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  if (statState.tab === 'log') {
    const regulars = S.regulars.slice().sort((a, b) => b.visits - a.visits).map((r) => {
      const car = AST.data.carById[r.carId];
      return `<div class="list-item"><div class="avatar sm">${r.emoji}</div>
        <div class="flex1 small"><b>${AST.u.esc(r.name)}</b> <span class="pill green">⭐ ${r.visits} ${AST.u.plural(r.visits, 'визит', 'визита', 'визитов')}</span>
        <div class="muted">${car ? AST.u.esc(car.name) : ''}</div></div></div>`;
    }).join('');
    const events = S.events.log.map((e) => `
      <div class="list-item"><div class="avatar sm">${e.ico}</div>
        <div class="flex1 small"><b>День ${e.day}: ${AST.u.esc(e.name)}</b><div class="muted">${AST.u.esc(e.result)}</div></div>
      </div>`).join('');
    const reviews = S.reviews.map((r) => `
      <div class="list-item review-item">
        <div class="avatar sm">💬</div>
        <div class="flex1 small">
          <div class="row wrap"><b>${AST.u.esc(r.name)}</b><span class="review-stars">${AST.u.stars(r.score)}</span><span class="dim">день ${r.day}</span></div>
          <div class="muted">${AST.u.esc(r.text)}</div>
        </div>
      </div>`).join('');
    body = `
      ${regulars ? `<div class="section-h"><h2>⭐ Постоянные клиенты</h2><span class="sub">${S.regulars.length} из 24 — возвращаются, пока довольны</span></div>
      <div class="grid3 mb12" style="gap:8px">${regulars}</div>` : ''}
      <div class="grid2 mb12" style="align-items:start">
        <div><div class="section-h"><h2>🎲 События</h2></div>
          <div class="list">${events || '<div class="empty-note">Пока тихо…</div>'}</div></div>
        <div><div class="section-h"><h2>💬 Отзывы клиентов</h2></div>
          <div class="list">${reviews || '<div class="empty-note">Отзывов пока нет</div>'}</div></div>
      </div>`;
  }

  root.innerHTML = `<div class="subtabs">${tabs}</div>${body}`;
};

Object.assign(AST.actions, {
  statTab(d) { statState.tab = d.tab; statState.search = ''; AST.ui.render('stats'); },
});
AST.inputs.statSearch = (v) => { statState.search = v; AST.ui.render('stats', true); };

/* ============================================================
   НАСТРОЙКИ
   ============================================================ */
const LOGOS = ['🔧', '🔩', '🚗', '🏎️', '🛠️', '⚙️', '🚘', '🏁', '⚡', '🦾', '🛞', '💎', '🔥', '🦅', '🐺', '👑'];

AST.panels.settings = function (root) {
  const S = AST.state;
  const st = S.settings;
  const accents = [
    ['cyan', '#22d3ee'], ['violet', '#a78bfa'], ['emerald', '#34d399'],
    ['amber', '#fbbf24'], ['rose', '#fb7185'],
  ];

  root.innerHTML = `
    <div class="grid2 mb12" style="align-items:start">
      <div class="card">
        <div class="card-title mb8">🏷️ Мой автосервис</div>
        <div class="row gap12 mb12">
          <div class="avatar lg">${S.meta.logo}</div>
          <div class="flex1">
            <b>${AST.u.esc(S.meta.name)}</b>
            <div class="small muted">Основан в день 1 • сейчас день ${S.time.day}</div>
          </div>
          <button class="btn small" data-act="setName">✏️ Переименовать</button>
        </div>
        <div class="small muted mb8">Логотип:</div>
        <div class="logo-pick">${LOGOS.map((l) =>
          `<button class="lp ${S.meta.logo === l ? 'on' : ''}" data-act="setLogo" data-l="${l}">${l}</button>`).join('')}</div>
      </div>

      <div class="card">
        <div class="card-title mb8">🎨 Оформление</div>
        <div class="small muted mb8">Тема:</div>
        <div class="row mb12">
          <button class="chip click ${st.theme === 'dark' ? 'on' : ''}" data-act="setTheme" data-t="dark">🌙 Тёмная</button>
          <button class="chip click ${st.theme === 'light' ? 'on' : ''}" data-act="setTheme" data-t="light">☀️ Светлая</button>
        </div>
        <div class="small muted mb8">Акцентный цвет:</div>
        <div class="theme-pick">${accents.map(([id, color]) =>
          `<button class="tp ${st.accent === id ? 'on' : ''}" style="background:${color}" data-act="setAccent" data-a="${id}"></button>`).join('')}</div>
      </div>

      <div class="card">
        <div class="card-title mb8">🔊 Звук</div>
        <div class="col">
          <button class="chip click ${st.sound ? 'on' : ''}" data-act="togSound">${st.sound ? '🔊 Звуки: вкл' : '🔇 Звуки: выкл'}</button>
          <button class="chip click ${st.music ? 'on' : ''}" data-act="togMusic">${st.music ? '🎵 Музыка: вкл' : '🎵 Музыка: выкл'}</button>
        </div>
        <div class="small muted mt8">Звуки синтезируются автоматически. Хотите свои? Положите mp3-файлы в папку
        <b>assets/audio/</b> (см. README там же) — игра подхватит их сама.</div>
      </div>

      <div class="card">
        <div class="card-title mb8">💾 Сохранение</div>
        <div class="col">
          <button class="chip click ${st.daySummary !== false ? 'on' : ''}" data-act="togDaySummary">${st.daySummary !== false ? '🌅 Сводка дня: вкл' : '🌅 Сводка дня: выкл'}</button>
          <button class="chip click ${st.autosave ? 'on' : ''}" data-act="togAutosave">${st.autosave ? '✅ Автосохранение: вкл' : '⬜ Автосохранение: выкл'}</button>
          <div class="row wrap">
            <button class="btn small" data-act="saveNow">💾 Сохранить сейчас</button>
            <button class="btn small primary" data-act="expFile" title="Скачает маленький файл — его удобно переслать себе в Telegram одним вложением">📤 Скачать файл</button>
            <button class="btn small" data-act="impFile" title="Выберите файл сохранения, скачанный на другом устройстве">📥 Загрузить из файла</button>
          </div>
          <div class="row wrap">
            <button class="btn tiny ghost" data-act="expSave">Экспорт текстом</button>
            <button class="btn tiny ghost" data-act="impSave">Импорт из текста</button>
          </div>
          <input type="file" id="save-file-input" accept=".txt,.save,text/plain" style="display:none">
          <button class="btn small danger" data-act="resetSave">🗑️ Начать игру заново</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title mb8">🎓 Обучение</div>
        <div class="small muted mb8">Забыли, как что работает? Пройдите обучение ещё раз.</div>
        <button class="btn small" data-act="tutRestart">Запустить обучение</button>
      </div>

      <div class="card">
        <div class="card-title mb8">ℹ️ Об игре</div>
        <div class="small muted">
          <b>Автосервис: Империя</b> — idle/tycoon о пути от гаража до международной сети.<br><br>
          60 автомобилей • 133 вида работ • 131 запчасть • 186 улучшений • 100 исследований •
          204 миссии • 306 достижений • 28 событий<br><br>
          Игра целиком работает в браузере, интернет не нужен.
        </div>
      </div>
    </div>
  `;
};

Object.assign(AST.actions, {
  async setName() {
    const name = await AST.modal.prompt('Название автосервиса', 'Например: Гараж Механика', AST.state.meta.name);
    if (name && name.trim()) {
      AST.state.meta.name = name.trim().slice(0, 30);
      AST.ui.updateHud();
      AST.ui.render('settings');
      AST.scene.refresh();
    }
  },
  setLogo(d) { AST.state.meta.logo = d.l; AST.ui.updateHud(); AST.ui.render('settings'); AST.scene.refresh(); },
  setTheme(d) {
    AST.state.settings.theme = d.t;
    document.body.dataset.theme = d.t;
    AST.ui.render('settings');
  },
  setAccent(d) {
    AST.state.settings.accent = d.a;
    document.body.dataset.accent = d.a;
    AST.ui.render('settings');
  },
  togSound() { AST.state.settings.sound = !AST.state.settings.sound; AST.audio.play('click'); AST.ui.render('settings'); },
  togMusic() {
    AST.state.settings.music = !AST.state.settings.music;
    if (AST.state.settings.music) AST.audio.tryMusic(); else AST.audio.stopMusic();
    AST.ui.render('settings');
  },
  togAutosave() { AST.state.settings.autosave = !AST.state.settings.autosave; AST.ui.render('settings'); },
  togDaySummary() { AST.state.settings.daySummary = AST.state.settings.daySummary === false; AST.ui.render('settings'); },
  saveNow() { AST.save.save(true); },
  expFile() {
    AST.save.exportFile();
    AST.ui.toast('📤', 'Файл сохранения скачан', 'Перешлите его себе в Telegram, на другом устройстве — «Загрузить из файла»', 'ok');
  },
  impFile() {
    const inp = AST.u.byId('save-file-input');
    if (!inp) return;
    inp.value = '';
    inp.onchange = async () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      const ok = await AST.modal.confirm('Загрузить сохранение?',
        `<b>${AST.u.esc(file.name)}</b><br>Текущий прогресс на этом устройстве будет заменён!`);
      if (!ok) return;
      const text = await file.text();
      const loaded = await AST.save.importStr(text);
      if (!loaded) AST.ui.toast('⚠️', 'Не получилось', 'Файл повреждён или это не сохранение игры', 'err');
    };
    inp.click();
  },
  async expSave() {
    const str = await AST.save.exportStr();
    const id = 'exp_' + AST.u.uid();
    AST.modal.show({
      title: '📤 Экспорт сохранения',
      body: `<p class="small muted">Нажмите «Скопировать» и перешлите код себе (например, в «Избранное» Telegram).
        На другом устройстве: Настройки → Импорт → вставить код.</p>
        <textarea id="${id}" class="input" style="width:100%;height:120px;user-select:all" readonly onclick="this.select()">${str}</textarea>`,
      buttons: [
        { label: '📋 Скопировать код', primary: true, onClick: () => {
          const doneToast = () => AST.ui.toast('📋', 'Код скопирован!', 'Теперь перешлите его себе на другое устройство', 'ok');
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(str).then(doneToast).catch(() => {
              AST.ui.toast('⚠️', 'Не удалось скопировать', 'Выделите код в окне вручную и скопируйте', 'warn');
            });
          } else {
            const tmp = document.createElement('textarea');
            tmp.value = str;
            document.body.appendChild(tmp);
            tmp.select();
            document.execCommand('copy');
            tmp.remove();
            doneToast();
          }
        } },
        { label: 'Закрыть' },
      ],
    });
  },
  impSave() {
    const id = 'imp_' + AST.u.uid();
    AST.modal.show({
      title: '📥 Импорт сохранения',
      body: `<p class="small muted">Вставьте код сохранения. Текущий прогресс будет заменён!</p>
        <textarea id="${id}" class="input" style="width:100%;height:120px" placeholder="Код сохранения…"></textarea>`,
      buttons: [
        { label: 'Загрузить', primary: true, onClick: async () => {
          const val = (AST.u.byId(id) || {}).value || '';
          const ok = await AST.save.importStr(val);
          if (!ok) AST.ui.toast('⚠️', 'Не получилось', 'Код повреждён или неполный', 'err');
        } },
        { label: 'Отмена' },
      ],
    });
  },
  async resetSave() {
    const ok = await AST.modal.confirm('Начать заново?',
      '<b>Весь прогресс будет удалён навсегда.</b><br>Империя, деньги, достижения — всё исчезнет. Вы уверены?',
      'Да, стереть всё', 'Отмена');
    if (ok) AST.save.reset();
  },
  tutRestart() { AST.tutorial.start(); },
});
