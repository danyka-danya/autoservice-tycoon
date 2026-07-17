/* ============================================================
   ИГРА: достижения — проверка порогов, награды очками науки
   ============================================================ */
'use strict';

AST.ach = (() => {

  const unlocked = (id) => !!AST.state.ach.unlocked[id];

  /** Периодическая проверка всех достижений */
  function check(silent = false) {
    const S = AST.state;
    const fresh = [];
    for (const a of AST.data.achievements) {
      if (S.ach.unlocked[a.id]) continue;
      if (AST.missions.metric(a.m) >= a.v) {
        S.ach.unlocked[a.id] = true;
        AST.addC('achUnlocked');
        S.rp += a.rwRp;
        AST.ownerXpAdd(10 + a.tier * 6);
        fresh.push(a);
      }
    }
    if (!fresh.length || silent) return fresh.length;
    if (fresh.length <= 3) {
      for (const a of fresh) {
        AST.ui.toast(a.ico, `Достижение: ${a.name}`, `${a.desc} • +${a.rwRp} 🔬`, 'gold');
      }
      AST.audio.play('achievement');
      AST.fx && AST.fx.confetti();
    } else {
      AST.ui.toast('🏆', `Открыто достижений: ${fresh.length}!`, 'Загляните во вкладку «Миссии»', 'gold');
      AST.audio.play('achievement');
    }
    AST.ui.dirty('missions');
    return fresh.length;
  }

  function count() {
    return Object.keys(AST.state.ach.unlocked).length;
  }

  return { check, unlocked, count };
})();
