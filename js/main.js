/* ============================================================
   ТОЧКА ВХОДА: загрузка/новая игра, приветствие, запуск цикла
   ============================================================ */
'use strict';

(function boot() {

  function setBootProgress(pct) {
    const el = AST.u.byId('boot-bar-fill');
    if (el) el.style.width = pct + '%';
  }

  function newGameSetup() {
    const S = AST.state;
    // стартовый механик-новичок
    const novice = AST.staffM.genApplicant('mechanic');
    novice.skill = 2;
    novice.speed = 0.95;
    novice.quality = 0.9;
    novice.salary = Math.round(AST.data.roles.mechanic.base * 0.85);
    novice.hiredDay = 1;
    S.staff.push(novice);
    AST.staffM.refreshApplicants(true);
    AST.missions.newDay();
  }

  function welcomeNew() {
    AST.modal.show({
      ico: '🔧',
      title: 'Автосервис: Империя',
      body: `<p>Вам достался <b>старый гараж на окраине</b>: один подъёмник, механик-стажёр
        и ${AST.u.fmt(AST.BAL.START_MONEY)} в кассе.</p>
        <p>Чините машины, нанимайте людей, стройте мойки и цеха, исследуйте технологии —
        и превратите гараж в <b>империю стоимостью $10 000 000</b>.</p>`,
      locked: true,
      buttons: [
        { label: '🎓 Начать с обучения', primary: true, onClick: () => AST.tutorial.start() },
        { label: 'Сразу к делу!', onClick: () => {} },
      ],
    });
  }

  function welcomeBack(offline) {
    const S = AST.state;
    let offlineHtml = '';
    if (offline) {
      offlineHtml = `<p>🌙 Пока вас не было (${Math.round(offline.hours)} ч), сервис работал вполсилы и заработал
        <b class="good">${AST.u.fmt(offline.gain)}</b>.</p>`;
    }
    AST.modal.show({
      ico: S.meta.logo,
      title: `С возвращением, босс!`,
      body: `<p><b>${AST.u.esc(S.meta.name)}</b> • день ${S.time.day} •
        репутация ${Math.round(S.rep)} • в кассе ${AST.u.fmt(S.money)}</p>${offlineHtml}`,
      buttons: [{ label: 'К работе!', primary: true }],
    });
  }

  function start() {
    setBootProgress(30);
    AST.audio.init();

    // загрузка или новая игра
    const saved = AST.save.load();
    const isNew = !saved;
    AST.state = saved || AST.newState();
    setBootProgress(55);

    // тема и акцент
    document.body.dataset.theme = AST.state.settings.theme || 'dark';
    document.body.dataset.accent = AST.state.settings.accent || 'cyan';

    if (isNew) newGameSetup();

    // серия входов по реальным дням
    AST.missions.checkLogin();

    // офлайн-доход для вернувшихся
    const offline = isNew ? null : AST.save.offlineReport();

    // тихо отметить уже выполненные достижения (без фейерверка)
    AST.ach.check(true);
    setBootProgress(80);

    // интерфейс
    AST.ui.init();
    AST.ui.showTab('garage');
    AST.ui.updateBadges();
    AST.loop.start();
    setBootProgress(100);

    // спрятать загрузочный экран
    setTimeout(() => {
      const bootEl = AST.u.byId('boot-screen');
      const app = AST.u.byId('app');
      app.classList.remove('hidden');
      bootEl.classList.add('off');
      setTimeout(() => bootEl.remove(), 700);

      if (isNew) welcomeNew();
      else if (!AST.state.meta.tutorialDone) AST.tutorial.start();
      else welcomeBack(offline);
    }, 350);

    // PWA: офлайн-кэш (работает на https/localhost; при file:// просто пропускается)
    if ('serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // сохранение при закрытии вкладки
    window.addEventListener('beforeunload', () => AST.save.save(false));
    // и при сворачивании (мобильные)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) AST.save.save(false);
    });
  }

  // страховка от ошибок: игра не должна молча умирать
  window.addEventListener('error', (e) => {
    console.error('Игровая ошибка:', e.error || e.message);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
