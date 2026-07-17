/* ============================================================
   ИГРА: движок случайных событий.
   Каждый игровой час — небольшой шанс события. Игра ставится
   на паузу, игрок делает выбор, результат показывается сразу.
   ============================================================ */
'use strict';

AST.events = (() => {
  const CHANCE_PER_HOUR = 0.05;
  const MIN_GAP_MIN = 180;   // не чаще, чем раз в 3 игровых часа

  function eligible() {
    return AST.data.events.filter((ev) => {
      try { return !ev.cond || ev.cond(); } catch (e) { return false; }
    });
  }

  /** Часовой тик */
  function hourly() {
    const S = AST.state;
    if (S.time.day < 2) return;                                // первый день — без сюрпризов
    if (S.time.abs - S.events.lastAbs < MIN_GAP_MIN) return;
    if (!AST.u.chance(CHANCE_PER_HOUR)) return;
    const pool = eligible();
    if (!pool.length) return;
    let ev = AST.u.pickW(pool, (e) => e.weight || 1);
    // навык «Везунчик»: шанс перебросить плохое событие на хорошее
    const luck = AST.mods().luck;
    if (ev.bad && luck > 0 && AST.u.chance(luck)) {
      const good = pool.filter((e) => !e.bad);
      if (good.length) ev = AST.u.pickW(good, (e) => e.weight || 1);
    }
    trigger(ev);
  }

  function trigger(ev) {
    const S = AST.state;
    S.events.lastAbs = S.time.abs;
    AST.addC('events');
    AST.audio.play('event');

    // пауза на время выбора
    const prevSpeed = S.time.speed;
    S.time.speed = 0;
    AST.ui.syncSpeedButtons();

    const buttons = ev.choices.map((ch) => ({
      label: ch.label,
      primary: ev.choices.indexOf(ch) === 0,
      onClick: () => {
        let result = '';
        try { result = ch.apply() || 'Готово.'; }
        catch (e) { console.warn('Ошибка события', ev.id, e); result = 'Ситуация разрешилась сама собой.'; }
        S.events.log.unshift({ day: S.time.day, name: ev.name, ico: ev.ico, result });
        if (S.events.log.length > 30) S.events.log.pop();
        S.time.speed = prevSpeed || 1;
        AST.ui.syncSpeedButtons();
        AST._modsDirty = true;
        AST.ui.toast(ev.ico, ev.name, result, 'ok');
        AST.ui.dirtyAll();
      },
    }));

    AST.modal.show({
      ico: ev.ico,
      title: ev.name,
      body: `<p>${AST.u.esc(ev.text)}</p>`,
      buttons,
      locked: true,   // нельзя закрыть крестиком — надо выбрать
    });
  }

  return { hourly, trigger };
})();
