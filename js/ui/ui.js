/* ============================================================
   UI: каркас интерфейса — вкладки, HUD, тосты, перерисовки
   ============================================================ */
'use strict';

AST.ui = (() => {
  let activeTab = 'garage';
  const dirtySet = new Set();
  let pendingMoney = 0;
  let moneyTimer = null;

  /* ---------- Инициализация ---------- */
  function init() {
    // вкладки
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });
    // скорость
    document.querySelectorAll('.spd-btn').forEach((btn) => {
      btn.addEventListener('click', () => AST.loop.setSpeed(Number(btn.dataset.spd)));
    });
    // клик по бренду — переименование
    AST.u.byId('hud-brand').addEventListener('click', () => AST.actions.setName());

    // колокольчик уведомлений
    AST.u.byId('hud-bell').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotifPanel();
    });
    document.addEventListener('click', (e) => {
      if (notifOpen && !e.target.closest('#notif-panel') && !e.target.closest('#hud-bell')) {
        toggleNotifPanel(false);
      }
    });
    updateBellBadge();

    // глобальная делегация действий
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t || t.disabled) return;
      const fn = AST.actions[t.dataset.act];
      if (fn) fn(t.dataset, t, e);
    });
    document.addEventListener('input', (e) => {
      const t = e.target.closest('[data-inp]');
      if (!t) return;
      const fn = AST.inputs[t.dataset.inp];
      if (fn) fn(t.value, t);
    });

    // горячие клавиши: пробел — пауза, 1-4 — скорость
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.code === 'Space') { e.preventDefault(); AST.loop.setSpeed(AST.state.time.speed === 0 ? 1 : 0); }
      if (e.key >= '1' && e.key <= '3') AST.loop.setSpeed([1, 2, 4][Number(e.key) - 1]);
    });

    initTips();
    syncSpeedButtons();
    updateHud();
  }

  /* ---------- Кастомные подсказки в стиле игры (вместо нативных title) ---------- */
  let tipEl = null;
  let tipTarget = null;

  function initTips() {
    // на сенсорных экранах подсказки выскакивали под пальцем и мешали нажатиям
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
    tipEl = AST.u.el('div', 'game-tip');
    document.body.appendChild(tipEl);

    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[title], [data-tip]');
      if (!t) { hideTip(); return; }
      // перехватываем нативный title, чтобы не показывался чёрный системный
      if (t.hasAttribute('title')) {
        t.dataset.tip = t.getAttribute('title');
        t.removeAttribute('title');
      }
      if (!t.dataset.tip) { hideTip(); return; }
      if (t === tipTarget) return;
      showTip(t, t.dataset.tip);
    });
    document.addEventListener('mouseout', (e) => {
      if (tipTarget && !tipTarget.contains(e.relatedTarget)) hideTip();
    });
    document.addEventListener('scroll', hideTip, true);
    window.addEventListener('resize', hideTip);
    document.addEventListener('click', hideTip);
  }

  function showTip(target, text) {
    tipTarget = target;
    tipEl.textContent = text;
    tipEl.classList.add('on');
    // сначала измерим, потом позиционируем
    const r = target.getBoundingClientRect();
    const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = AST.u.clamp(x, 8, innerWidth - tw - 8);
    let y = r.top - th - 8;                      // над элементом
    if (y < 8) y = r.bottom + 8;                 // не влезло — под элементом
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
  }

  function hideTip() {
    tipTarget = null;
    if (tipEl) tipEl.classList.remove('on');
  }

  /* ---------- Вкладки ---------- */
  function showTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + tab));
    AST.audio.play('click');
    renderNow(tab);
    if (AST.tutorial) AST.tutorial.onTab(tab);
  }

  /** Немедленная перерисовка вкладки (если она открыта) */
  function render(tab, keepFocus = false) {
    if (tab !== activeTab) { dirtySet.add(tab); return; }
    renderNow(tab, keepFocus);
  }

  function renderNow(tab, keepFocus = false) {
    const panel = AST.u.byId('tab-' + tab);
    const renderer = AST.panels[tab];
    if (!panel || !renderer) return;
    hideTip();   // элемент под курсором сейчас пересоздастся

    // запомнить скролл и фокус в поисковых полях
    const scroll = panel.scrollTop;
    let focusInp = null, cursor = 0;
    if (keepFocus && document.activeElement && document.activeElement.dataset && document.activeElement.dataset.inp) {
      focusInp = document.activeElement.dataset.inp;
      cursor = document.activeElement.selectionStart || 0;
    }

    renderer(panel);
    panel.scrollTop = scroll;

    if (focusInp) {
      const el = panel.querySelector(`[data-inp="${focusInp}"]`);
      if (el) { el.focus(); try { el.setSelectionRange(cursor, cursor); } catch (e) {} }
    }
    dirtySet.delete(tab);
  }

  /** Пометить вкладку на перерисовку (лениво) */
  function dirty(tab) { dirtySet.add(tab); }
  function dirtyAll() {
    ['garage', 'staff', 'stock', 'upgrades', 'research', 'finance', 'missions', 'stats'].forEach((t) => dirtySet.add(t));
  }

  /* ---------- Периодический тик интерфейса ---------- */
  let liveCount = 0;

  function tick() {
    updateHud();

    const typing = document.activeElement && document.activeElement.matches('input, textarea');

    if (activeTab === 'garage') {
      AST.scene.update();
      if (dirtySet.has('garage')) renderNow('garage');
    } else if (dirtySet.has(activeTab) && !typing) {
      renderNow(activeTab);
    }

    // «живые» вкладки: раз в 2 секунды перерисовываем активную,
    // чтобы таймеры исследований, доставок и терпения шли на глазах.
    // Пропускаем, пока открыта подсказка или пользователь печатает.
    if (++liveCount >= 10) {
      liveCount = 0;
      if (AST.state.time.speed > 0 && !tipTarget && !typing) {
        renderNow(activeTab);
      }
    }
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    const S = AST.state;
    if (!S) return;
    AST.u.byId('hud-money').textContent = AST.u.fmt(S.money);

    // прибыль дня «в моменте» (с учётом предстоящих вечерних платежей)
    const netEl = AST.u.byId('hud-net');
    if (netEl) {
      const forecast = AST.econ.dayForecast();
      netEl.textContent = (forecast >= 0 ? '+' : '−') + AST.u.fmt(Math.abs(forecast)).replace('-', '');
      netEl.style.color = forecast >= 0 ? 'var(--good)' : 'var(--bad)';
      const t = AST.econ.todayNet();
      const fc = AST.econ.fixedDailyCosts();
      AST.u.byId('hud-net-wrap').dataset.tip =
        `Итог дня, если всё останется как есть. Заработано сегодня: ${AST.u.fmt(t.inc)}, потрачено: ${AST.u.fmt(t.exp)}. ` +
        `Вечером спишется ещё ≈${AST.u.fmt(fc.total)}: зарплаты ${AST.u.fmt(fc.salary)}, аренда ${AST.u.fmt(fc.rent)}, коммуналка ${AST.u.fmt(fc.utilities)}` +
        (fc.loans ? `, кредиты ${AST.u.fmt(fc.loans)}` : '') +
        (fc.insurance ? `, страховка ${AST.u.fmt(fc.insurance)}` : '') +
        `. Если минус — экономьте: зарплаты и аренда съедают больше, чем приносит сервис`;
    }

    // темп заработка: чистыми за последний игровой час
    const rateEl = AST.u.byId('hud-rate');
    if (rateEl) {
      const rate = AST.econ.incomeRate();
      rateEl.textContent = (rate >= 0 ? '+' : '−') + AST.u.fmt(Math.abs(rate)).replace('-', '') + '/ч';
      rateEl.style.color = rate > 0 ? 'var(--good)' : rate < 0 ? 'var(--bad)' : 'var(--txt2)';
      AST.u.byId('hud-rate-wrap').dataset.tip =
        'Темп в моменте: сколько чистыми заработано за последний игровой час (1 игровой час = 1 минута реального времени на скорости ×1). ' +
        'Крупные покупки и вечерние платежи временно уводят темп в минус — это нормально';
    }
    AST.u.byId('hud-rep').textContent = (Math.round(S.rep * 10) / 10).toFixed(0);
    AST.u.byId('hud-rp').textContent = Math.floor(S.rp);
    AST.u.byId('hud-lvl').textContent = S.ownerLvl;
    AST.u.byId('hud-xpfill').style.width = AST.u.clamp((S.ownerXp / AST.ownerXpNeed(S.ownerLvl)) * 100, 0, 100) + '%';
    AST.u.byId('hud-clock').textContent = AST.u.fmtClock(S.time.min);
    AST.u.byId('hud-day').textContent = 'День ' + S.time.day;
    const season = AST.time.SEASONS[S.time.season];
    AST.u.byId('hud-season').textContent = season.ico + ' ' + season.name;
    const w = AST.time.WEATHER[S.time.weather];
    AST.u.byId('hud-weather').textContent = w ? w.ico : '☀️';
    AST.u.byId('hud-weather').title = w ? w.name : '';
    AST.u.byId('hud-name').textContent = S.meta.name;
    AST.u.byId('hud-logo').textContent = S.meta.logo;
    const tierEl = AST.u.byId('hud-tier');
    if (tierEl) {
      const tier = AST.data.tiers[S.tier || 0];
      const next = AST.data.tiers[(S.tier || 0) + 1];
      tierEl.textContent = tier.ico + ' ' + tier.name;
      AST.u.byId('hud-brand').dataset.tip = next
        ? `Статус компании. Следующий: ${next.ico} ${next.name} при стоимости ${AST.u.fmt(next.value)} (сейчас ${AST.u.fmt(AST.econ.value())}). Клик — переименовать сервис`
        : 'Максимальный статус — империя построена! Клик — переименовать сервис';
    }
  }

  /* ---------- Утренняя сводка дня ---------- */
  function showDaySummary(sum) {
    if (!sum) return;
    const best = sum.bestMech
      ? `<div class="list-item"><div class="avatar sm">${sum.bestMech.emoji}</div>
         <div class="flex1 small"><b>Механик дня: ${AST.u.esc(sum.bestMech.name)}</b>
         <div class="muted">принёс сервису ${AST.u.fmt(sum.bestMech.earned)}</div></div>🏅</div>`
      : '';
    AST.modal.show({
      ico: '🌅',
      title: `Итоги дня ${sum.day}`,
      body: `
        <div class="grid2" style="gap:8px">
          <div class="tile"><div class="tile-val good">+${AST.u.fmt(sum.income)}</div><div class="tile-lab">Доходы</div></div>
          <div class="tile"><div class="tile-val bad">−${AST.u.fmt(sum.expenses)}</div><div class="tile-lab">Расходы</div></div>
          <div class="tile"><div class="tile-val ${sum.profit >= 0 ? 'good' : 'bad'}">${sum.profit >= 0 ? '+' : '−'}${AST.u.fmt(Math.abs(sum.profit))}</div><div class="tile-lab">Прибыль</div></div>
          <div class="tile"><div class="tile-val">${sum.clients} / ${sum.lost}</div><div class="tile-lab">Клиенты / потеряно</div></div>
        </div>
        ${sum.perfect ? `<div class="small tac mt8 gold-c">✨ Идеальных ремонтов: ${sum.perfect}</div>` : ''}
        <div class="mt8">${best}</div>`,
      buttons: [
        { label: 'В новый день!', primary: true },
        { label: 'Больше не показывать', onClick: () => {
          AST.state.settings.daySummary = false;
          toast('🌅', 'Сводка дня отключена', 'Включить обратно можно в Настройках', 'ok');
        } },
      ],
    });
  }

  /** Пульс денег в HUD + летящая сумма (агрегируем мелочь) */
  function moneyFlash(amount) {
    pendingMoney += amount;
    if (moneyTimer) return;
    moneyTimer = setTimeout(() => {
      const total = pendingMoney;
      pendingMoney = 0;
      moneyTimer = null;
      if (Math.abs(total) < 1) return;
      const wrap = AST.u.byId('hud-money-wrap');
      if (wrap) {
        wrap.classList.remove('flash');
        void wrap.offsetWidth;
        wrap.classList.add('flash');
      }
      AST.fx.money(total);
    }, 300);
  }

  /* ---------- Тосты + журнал уведомлений ---------- */
  let notifOpen = false;

  function toast(ico, title, msg = '', type = '') {
    pushNotif(ico, title, msg, type);
    const rootEl = AST.u.byId('toast-root');
    if (!rootEl) return;
    while (rootEl.children.length >= 4) rootEl.firstChild.remove();
    const t = AST.u.el('div', 'toast ' + type, `
      <div class="t-ico">${ico}</div>
      <div class="flex1"><div class="t-title">${AST.u.esc(title)}</div>
      ${msg ? `<div class="t-msg">${AST.u.esc(msg)}</div>` : ''}</div>`);
    rootEl.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 350);
    }, 4200);
  }

  /** Запись в журнал колокольчика */
  function pushNotif(ico, title, msg, type) {
    const S = AST.state;
    if (!S || !S.notifications) return;
    S.notifications.unshift({
      ico, title, msg, type,
      day: S.time.day, min: Math.floor(S.time.min),
      read: false,
    });
    if (S.notifications.length > 60) S.notifications.length = 60;
    updateBellBadge();
    const bell = AST.u.byId('hud-bell');
    if (bell) {
      bell.classList.remove('ringing');
      void bell.offsetWidth;
      bell.classList.add('ringing');
    }
    if (notifOpen) renderNotifPanel();
  }

  function updateBellBadge() {
    const S = AST.state;
    const b = AST.u.byId('bell-badge');
    if (!b || !S) return;
    const unread = (S.notifications || []).filter((n) => !n.read).length;
    if (unread > 0) { b.textContent = unread > 99 ? '99+' : unread; b.classList.remove('hidden'); }
    else b.classList.add('hidden');
  }

  function toggleNotifPanel(force) {
    notifOpen = force != null ? force : !notifOpen;
    const holder = AST.u.byId('notif-holder') || (() => {
      const d = AST.u.el('div', '');
      d.id = 'notif-holder';
      document.body.appendChild(d);
      return d;
    })();
    if (!notifOpen) { holder.innerHTML = ''; return; }
    renderNotifPanel();
    // прочитано всё, что увидел
    (AST.state.notifications || []).forEach((n) => { n.read = true; });
    updateBellBadge();
  }

  function renderNotifPanel() {
    const holder = AST.u.byId('notif-holder');
    if (!holder) return;
    const S = AST.state;
    const items = (S.notifications || []).map((n) => `
      <div class="notif-item ${n.type || ''} ${n.read ? '' : 'unread'}">
        <div class="n-ico">${n.ico}</div>
        <div class="flex1">
          <div class="n-title">${AST.u.esc(n.title)}</div>
          ${n.msg ? `<div class="n-msg">${AST.u.esc(n.msg)}</div>` : ''}
        </div>
        <div class="n-time">д.${n.day} ${AST.u.fmtClock(n.min)}</div>
      </div>`).join('');
    holder.innerHTML = `
      <div class="notif-panel" id="notif-panel">
        <div class="notif-head">
          <span>🔔 Уведомления</span>
          <div class="row">
            <button class="btn tiny ghost" id="notif-clear">Очистить</button>
            <button class="btn tiny" id="notif-close">✕</button>
          </div>
        </div>
        <div class="notif-list">${items || '<div class="empty-note">Пока тихо. Все важные события будут собираться здесь.</div>'}</div>
      </div>`;
    AST.u.byId('notif-close').onclick = () => toggleNotifPanel(false);
    AST.u.byId('notif-clear').onclick = () => {
      AST.state.notifications = [];
      updateBellBadge();
      renderNotifPanel();
    };
  }

  /* ---------- Значки на вкладках ---------- */
  function updateBadges() {
    const set = (tab, n) => {
      const b = document.querySelector(`[data-badge="${tab}"]`);
      if (!b) return;
      if (n > 0) { b.textContent = n > 99 ? '99+' : n; b.classList.remove('hidden'); }
      else b.classList.add('hidden');
    };
    set('missions', AST.missions.claimableCount());
    // наука: можно ли начать что-то прямо сейчас
    let canRe = 0;
    if (!AST.state.research.cur) {
      for (const r of AST.data.research) {
        if (AST.research.canStart(r.id)) { canRe = 1; break; }
      }
    }
    set('research', canRe);
  }

  function syncSpeedButtons() {
    const spd = AST.state ? AST.state.time.speed : 1;
    document.querySelectorAll('.spd-btn').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.spd) === spd);
    });
  }

  const getActiveTab = () => activeTab;

  return { init, showTab, render, dirty, dirtyAll, tick, updateHud, moneyFlash, toast, updateBadges, syncSpeedButtons, getActiveTab, toggleNotifPanel, updateBellBadge, showDaySummary };
})();
