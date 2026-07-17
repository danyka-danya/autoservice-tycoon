/* ============================================================
   UI: обучение для новых игроков (пошаговый тур с подсветкой)
   ============================================================ */
'use strict';

AST.tutorial = (() => {
  let step = -1;
  let rootEl = null;

  const STEPS = [
    {
      title: 'Добро пожаловать! 👋',
      text: 'Вы — владелец маленького гаража у дороги. Впереди путь до международной сети автосервисов стоимостью в десятки миллионов. Покажу, что здесь как!',
    },
    {
      tab: 'garage', sel: '#scene',
      title: 'Ваш сервис 🏭',
      text: 'Это живая сцена: клиенты приезжают, ждут на парковке, машины заезжают в боксы, механики чинят — и всё это само! Ночью время летит быстрее.',
    },
    {
      tab: 'garage', sel: '#hud-speed',
      title: 'Управление временем ⏱️',
      text: 'Пауза и ускорение до ×4. Пробел — пауза, клавиши 1–3 — скорость. 1 секунда = 1 игровая минута.',
    },
    {
      tab: 'staff', sel: '#tab-staff',
      title: 'Команда 👥',
      text: 'Нанимайте механиков и другие роли, следите за усталостью и настроением, отправляйте на курсы. Уставший механик работает медленно, несчастный — увольняется.',
    },
    {
      tab: 'stock', sel: '#tab-stock',
      title: 'Склад 📦',
      text: 'Для ремонта нужны запчасти! Секция «Что заказать» сама подскажет: 🔴 деталь ждут прямо сейчас, 🔥 ходовая заканчивается. Нет детали на складе — курьер привезёт с наценкой +60% и съест вашу прибыль.',
    },
    {
      tab: 'upgrades', sel: '#tab-upgrades',
      title: 'Улучшения ⭐',
      text: '186 улучшений: маркетинг ведёт клиентов, комфорт удерживает их в очереди, оборудование ускоряет работу. Всё складывается!',
    },
    {
      tab: 'research', sel: '#tab-research',
      title: 'Наука 🔬',
      text: 'Очки исследований капают за каждый ремонт. 100 технологий: новые боксы, автозаказ деталей, электромобили, франшизы. Плюс навыки владельца за уровни.',
    },
    {
      tab: 'finance', sel: '#tab-finance',
      title: 'Финансы 💰',
      text: 'Зарплаты, аренда, налоги раз в неделю… Следите за прибылью! Тут же кредиты, депозит, страховка и филиалы в других городах.',
    },
    {
      tab: 'missions', sel: '#tab-missions',
      title: 'Миссии и награды 🎯',
      text: '204 миссии, 306 достижений, ежедневные задания и сундуки. Заглядывайте сюда за наградами — они здорово ускоряют развитие.',
    },
    {
      tab: 'garage',
      title: 'Вперёд! 🚀',
      text: 'Совет на старт: наймите второго механика, купите масло и колодки на склад и вложитесь в маркетинг. Удачи, босс!',
    },
  ];

  function start() {
    step = -1;
    rootEl = AST.u.byId('tutorial-root');
    next();
  }

  function next() {
    step++;
    if (step >= STEPS.length) return finish();
    const s = STEPS[step];
    if (s.tab && AST.ui.getActiveTab() !== s.tab) AST.ui.showTab(s.tab);
    // подождать отрисовку вкладки
    requestAnimationFrame(() => requestAnimationFrame(() => draw(s)));
  }

  function draw(s) {
    const target = s.sel ? document.querySelector(s.sel) : null;
    let spotStyle = '';
    let boxStyle = '';
    if (target) {
      const r = target.getBoundingClientRect();
      const pad = 6;
      spotStyle = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;`;
      // бокс под/над элементом
      const below = r.bottom + 190 < innerHeight;
      const boxTop = below ? r.bottom + 14 : Math.max(10, r.top - 190);
      const boxLeft = AST.u.clamp(r.left + r.width / 2 - 170, 10, innerWidth - 360);
      boxStyle = `left:${boxLeft}px;top:${boxTop}px;`;
    } else {
      boxStyle = `left:50%;top:50%;transform:translate(-50%,-50%);`;
    }

    rootEl.innerHTML = `
      <div class="tut-back">
        ${target ? `<div class="tut-spot" style="${spotStyle}"></div>` : '<div class="tut-dim"></div>'}
        <div class="tut-box" style="${boxStyle}">
          <div class="tut-step">ШАГ ${step + 1} / ${STEPS.length}</div>
          <div class="tut-title">${s.title}</div>
          <div class="tut-text">${s.text}</div>
          <div class="row mt12" style="justify-content:flex-end">
            <button class="btn small ghost" data-tut="skip">Пропустить</button>
            <button class="btn small primary" data-tut="next">${step === STEPS.length - 1 ? 'Играть!' : 'Далее →'}</button>
          </div>
        </div>
      </div>`;

    rootEl.querySelector('[data-tut="next"]').onclick = () => { AST.audio.play('click'); next(); };
    rootEl.querySelector('[data-tut="skip"]').onclick = finish;
  }

  function finish() {
    if (rootEl) rootEl.innerHTML = '';
    AST.state.meta.tutorialDone = true;
    AST.ui.showTab('garage');
    AST.save.save(false);
  }

  /** при ручной смене вкладки во время тура — просто перерисуем шаг */
  function onTab() { /* шаги сами переключают вкладки; ничего не делаем */ }

  return { start, onTab };
})();
