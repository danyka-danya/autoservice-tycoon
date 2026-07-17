/* ============================================================
   ИГРА: главный цикл.
   1 реальная секунда = 1 игровая минута × скорость.
   Ночью (сервис пуст и закрыт) время летит в 18 раз быстрее.
   ============================================================ */
'use strict';

AST.loop = (() => {
  let last = 0;
  let achTimer = 0;
  let uiTimer = 0;
  let running = false;

  /* Ночью сервис закрыт и ничего не происходит — время летит быстрее,
     даже если в боксах остались машины (они ждут утра). */
  function nightFast() {
    return AST.time.isOpen() ? 1 : 18;
  }

  function frame(ts) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!last) { last = ts; return; }
    let dtReal = (ts - last) / 1000;
    last = ts;
    if (dtReal > 5) dtReal = 5;               // вкладка была скрыта
    if (dtReal <= 0) return;

    const S = AST.state;
    S.meta.playMin += dtReal / 60;

    const speed = S.time.speed;
    if (speed > 0) {
      const dtMin = dtReal * speed * nightFast();

      // время + часовые события
      const t = AST.time.tick(dtMin);
      for (let h = 0; h < t.hoursCrossed; h++) {
        AST.garage.hourly();
        AST.staffM.hourly();
        AST.events.hourly();
      }

      // системы
      AST.clients.tick(dtMin);
      AST.contracts.tick(dtMin);
      AST.repair.tick(dtMin);
      AST.inv.tick(dtMin);
      AST.research.tick(dtMin);
    }

    // достижения и значки — раз в 2 секунды
    achTimer += dtReal;
    if (achTimer > 2) {
      achTimer = 0;
      AST.ach.check();
      AST.econ.checkTier();
      AST.ui.updateBadges();
    }

    // интерфейс — 5 раз в секунду достаточно
    uiTimer += dtReal;
    if (uiTimer > 0.2) {
      uiTimer = 0;
      AST.ui.tick();
    }

    AST.save.autoTick();
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }

  function stop() { running = false; }

  function setSpeed(n) {
    AST.state.time.speed = n;
    AST.ui.syncSpeedButtons();
    if (n > 0) AST.audio.play('click');
  }

  return { start, stop, setSpeed };
})();
