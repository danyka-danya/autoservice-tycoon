/* ============================================================
   ИГРА: миссии, ежедневные задания, серия входов, сундуки
   ============================================================ */
'use strict';

AST.missions = (() => {

  /* ---------- Метрики ---------- */
  function metric(m) {
    const S = AST.state;
    switch (m) {
      case 'money': return S.money;
      case 'rep': return S.rep;
      case 'staff': return S.staff.length;
      case 'bays': return S.garage.bays.length;
      case 'value': return AST.econ.value();
      case 'ownerLvl': return S.ownerLvl;
      default:
        if (m.startsWith('fac_')) return AST.garage.facLevel(m.slice(4));
        return S.c[m] || 0;
    }
  }

  const isDone = (ms) => ms.goals.every((g) => metric(g.m) >= g.v);
  const isClaimed = (ms) => !!AST.state.missions.claimed[ms.id];
  const claimable = (ms) => isDone(ms) && !isClaimed(ms);

  function progress(ms) {
    // средний прогресс по целям 0..1
    let sum = 0;
    for (const g of ms.goals) sum += Math.min(1, metric(g.m) / g.v);
    return sum / ms.goals.length;
  }

  function claim(id) {
    const S = AST.state;
    const ms = AST.data.missionById[id];
    if (!ms || !claimable(ms)) return false;
    S.missions.claimed[id] = true;
    AST.addC('missionsDone');
    AST.econ.earn(ms.rw.money, 'other', 'Награда за миссию');
    AST.research.addRp(ms.rw.rp);
    AST.ownerXpAdd(ms.rw.xp);
    AST.audio.play('chest');
    AST.fx && AST.fx.confetti();
    AST.ui.toast('🎯', `Миссия «${ms.name}» выполнена!`, `+${AST.u.fmt(ms.rw.money)} • +${ms.rw.rp} 🔬 • +${ms.rw.xp} XP`, 'gold');
    AST.ui.dirty('missions');
    return true;
  }

  /** Видимые сюжетные миссии: первые 3 незабранные */
  function visibleStory() {
    return AST.data.storyMissions.filter((ms) => !isClaimed(ms)).slice(0, 3);
  }

  /** Активные серийные: по одной текущей ступени на направление */
  function visibleChains() {
    const byMetric = {};
    for (const ms of AST.data.chainMissions) {
      if (isClaimed(ms)) continue;
      if (!byMetric[ms.m] || ms.tier < byMetric[ms.m].tier) byMetric[ms.m] = ms;
    }
    return Object.values(byMetric).sort((a, b) => progress(b) - progress(a));
  }

  function claimableCount() {
    let n = 0;
    for (const ms of visibleStory()) if (claimable(ms)) n++;
    for (const ms of visibleChains()) if (claimable(ms)) n++;
    for (const t of AST.state.daily.tasks) if (dailyDone(t) && !AST.state.daily.claimed[t.id]) n++;
    if (dailyChestReady()) n++;
    if (streakClaimable()) n++;
    return n;
  }

  /* ---------- Ежедневные задания ---------- */
  function newDay() {
    const S = AST.state;
    const scale = AST.u.clamp(1 + S.time.day / 12 + S.rep / 45, 1, 40);
    // задания про 5★ появляются, когда игрок уже умеет их получать
    const pool = AST.data.dailyTemplates.filter((t) => {
      if (t.m === 'perfect' && S.c.perfect < 3) return false;
      if (t.m === 'reviews5' && S.c.reviews5 < 5) return false;
      return true;
    });
    const picked = AST.u.shuffle(pool).slice(0, 3);
    S.daily.tasks = picked.map((t) => {
      const v = Math.max(1, Math.round(t.base * scale));
      return { id: t.id, m: t.m, v, ico: t.ico, name: t.name, desc: t.desc(v) };
    });
    S.daily.claimed = {};
    S.daily.chestClaimed = false;
    S.daily.snap = {
      repairs: S.c.repairs, clients: S.c.clients, income: S.c.income,
      partsBought: S.c.partsBought, perfect: S.c.perfect, reviews5: S.c.reviews5,
      lost: S.c.lost,
    };
    AST.ui.dirty('missions');
  }

  function dailyProgress(task) {
    const S = AST.state;
    const base = S.daily.snap[task.m] || 0;
    return Math.max(0, (S.c[task.m] || 0) - base);
  }

  const dailyDone = (task) => dailyProgress(task) >= task.v;

  function claimDaily(taskId) {
    const S = AST.state;
    const task = S.daily.tasks.find((t) => t.id === taskId);
    if (!task || !dailyDone(task) || S.daily.claimed[taskId]) return false;
    S.daily.claimed[taskId] = true;
    const money = Math.round(120 * AST.econ.eventScale());
    AST.econ.earn(money, 'other', 'Ежедневное задание');
    AST.research.addRp(5);
    AST.ownerXpAdd(25);
    AST.addC('dailyDone');
    AST.audio.play('cash');
    AST.ui.toast('✅', `Задание «${task.name}» выполнено`, `+${AST.u.fmt(money)} • +5 🔬`, 'ok');
    AST.ui.dirty('missions');
    return true;
  }

  const dailyChestReady = () => {
    const S = AST.state;
    return S.daily.tasks.length > 0 &&
      S.daily.tasks.every((t) => S.daily.claimed[t.id]) &&
      !S.daily.chestClaimed;
  };

  /** Сундук за все ежедневки: случайная приятность */
  function claimDailyChest() {
    const S = AST.state;
    if (!dailyChestReady()) return false;
    S.daily.chestClaimed = true;
    AST.addC('chests');
    const s = AST.econ.eventScale();
    const roll = AST.u.ri(1, 4);
    let msg = '';
    if (roll === 1) { const v = Math.round(500 * s); AST.econ.earn(v, 'other', 'Сундук'); msg = `Деньги: +${AST.u.fmt(v)}`; }
    else if (roll === 2) { AST.research.addRp(25); msg = 'Очки науки: +25 🔬'; }
    else if (roll === 3) { AST.addBoost('income', 0.25, 12, 'Сундук: удачный день'); msg = 'Буст: +25% к доходу на 12 часов'; }
    else { AST.addBoost('clients', 0.35, 12, 'Сундук: слава'); msg = 'Буст: +35% клиентов на 12 часов'; }
    AST.audio.play('chest');
    AST.fx && AST.fx.confetti();
    AST.ui.toast('🎁', 'Сундук открыт!', msg, 'gold');
    AST.ui.dirty('missions');
    return true;
  }

  /* ---------- Серия входов (по реальным дням) ---------- */
  function checkLogin() {
    const S = AST.state;
    const today = new Date().toDateString();
    if (S.daily.lastLogin === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    S.daily.streak = (S.daily.lastLogin === yesterday) ? S.daily.streak + 1 : 1;
    S.daily.lastLogin = today;
    if (S.daily.streak > (S.c.streakMax || 0)) S.c.streakMax = S.daily.streak;
  }

  const streakClaimable = () => {
    const S = AST.state;
    return S.daily.lastLogin && S.daily.streakDate !== S.daily.lastLogin;
  };

  function claimStreak() {
    const S = AST.state;
    if (!streakClaimable()) return false;
    S.daily.streakDate = S.daily.lastLogin;
    const idx = (S.daily.streak - 1) % AST.data.streakRewards.length;
    const rw = AST.data.streakRewards[idx];
    const mult = 1 + Math.floor((S.daily.streak - 1) / 7) * 0.5;   // каждая неделя серии добавляет +50%
    if (rw.money) AST.econ.earn(Math.round(rw.money * mult), 'other', 'Награда за вход');
    if (rw.rp) AST.research.addRp(Math.round(rw.rp * mult));
    if (idx === 6) { AST.addC('chests'); AST.fx && AST.fx.confetti(); }
    AST.audio.play('chest');
    AST.ui.toast('🔥', `День входа №${S.daily.streak}`, `Награда: ${rw.label}${mult > 1 ? ` ×${mult}` : ''}`, 'gold');
    AST.ui.dirty('missions');
    return true;
  }

  return {
    metric, isDone, isClaimed, claimable, progress, claim,
    visibleStory, visibleChains, claimableCount,
    newDay, dailyProgress, dailyDone, claimDaily, dailyChestReady, claimDailyChest,
    checkLogin, streakClaimable, claimStreak,
  };
})();
