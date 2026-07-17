/* ============================================================
   ИГРА: исследования и навыки владельца
   ============================================================ */
'use strict';

AST.research = (() => {

  const isDone = (id) => !!AST.state.research.done[id];

  /** Есть ли особый эффект (ev, autoorder, franchise…) */
  function hasSp(sp) {
    for (const id in AST.state.research.done) {
      const r = AST.data.researchById[id];
      if (r && r.sp === sp) return true;
    }
    return false;
  }

  function canStart(id) {
    const S = AST.state;
    const r = AST.data.researchById[id];
    if (!r || isDone(id) || S.research.cur) return false;
    if (r.req && !isDone(r.req)) return false;
    return S.rp >= r.rp && S.money >= r.money;
  }

  function start(id) {
    const S = AST.state;
    const r = AST.data.researchById[id];
    if (!r || isDone(id)) return false;
    if (S.research.cur) {
      AST.ui.toast('🔬', 'Лаборатория занята', 'Дождитесь окончания текущего исследования', 'warn');
      return false;
    }
    if (r.req && !isDone(r.req)) return false;
    if (S.rp < r.rp) {
      AST.ui.toast('🔬', 'Не хватает очков науки', `Нужно ${r.rp} 🔬 — они капают за ремонты`, 'err');
      return false;
    }
    if (!AST.econ.trySpend(r.money, 'research', r.name)) return false;
    S.rp -= r.rp;
    S.research.cur = { id, leftH: r.hours, totalH: r.hours };
    AST.audio.play('buy');
    AST.ui.dirty('research');
    return true;
  }

  function tick(dtMin) {
    const S = AST.state;
    const cur = S.research.cur;
    if (!cur) return;
    cur.leftH -= dtMin / 60;
    if (cur.leftH <= 0) {
      const r = AST.data.researchById[cur.id];
      S.research.done[cur.id] = true;
      S.research.cur = null;
      AST.addC('research');
      AST._modsDirty = true;
      AST.audio.play('achievement');
      AST.fx && AST.fx.confetti();
      AST.ui.toast('🔬', `Исследовано: ${r.name}`, r.desc, 'gold');
      AST.ownerXpAdd(30);
      AST.ui.dirty('research');
      AST.ui.dirtyAll();
    }
  }

  /** Начислить очки исследований */
  function addRp(n) {
    AST.state.rp += n * (1 + AST.mods().rp);
  }

  /* ---------- Навыки владельца ---------- */
  function skillLvl(id) {
    return AST.state.ownerSkills[id] || 0;
  }

  function spendSkill(id) {
    const S = AST.state;
    if (S.skillPts <= 0) {
      AST.ui.toast('👑', 'Нет очков навыков', 'Очки дают уровни владельца (опыт за ремонты и миссии)', 'warn');
      return false;
    }
    const lvl = skillLvl(id);
    if (lvl >= 10) return false;
    S.ownerSkills[id] = lvl + 1;
    S.skillPts--;
    AST._modsDirty = true;
    AST.audio.play('level');
    const sk = AST.data.ownerSkillById[id];
    AST.ui.toast(sk.ico, `${sk.name} — уровень ${lvl + 1}`, sk.desc, 'ok');
    AST.ui.dirty('research');
    return true;
  }

  return { isDone, hasSp, canStart, start, tick, addRp, skillLvl, spendSkill };
})();
