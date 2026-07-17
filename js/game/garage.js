/* ============================================================
   ИГРА: гараж — боксы, подъёмники, территория, постройки,
   пассивный доход сервисов (мойка, шиномонтаж и т.д.)
   ============================================================ */
'use strict';

AST.garage = (() => {

  /* ---------- Боксы ---------- */

  function maxBays() {
    let cap = AST.BAL.LAND_CAP[AST.state.garage.land] || 2;
    for (const id in AST.state.research.done) {
      const r = AST.data.researchById[id];
      if (r && r.sp === 'bays2') cap += 2;
    }
    return cap;
  }

  const canAddBay = () => AST.state.garage.bays.length < maxBays();

  function nextBayCost() {
    const n = AST.state.garage.bays.length;
    return Math.round(AST.BAL.BAY_BASE_COST * Math.pow(AST.BAL.BAY_COST_MULT, n - 1) * AST.state.inflation);
  }

  function buyBay() {
    const S = AST.state;
    if (!canAddBay()) {
      AST.ui.toast('🏗️', 'Нет места', 'Расширьте территорию или исследуйте оборудование', 'err');
      return false;
    }
    const cost = nextBayCost();
    if (!AST.econ.trySpend(cost, 'equip', 'Новый бокс с подъёмником')) return false;
    addBay(1);
    AST.audio.play('buy');
    AST.fx && AST.fx.ringAt();
    AST.ui.toast('🏗️', 'Новый бокс построен!', `Теперь боксов: ${S.garage.bays.length}`, 'ok');
    return true;
  }

  /** Добавить бокс без оплаты (события/аукцион) */
  function addBay(tier = 1) {
    const S = AST.state;
    S.garage.bays.push({ id: 'b' + AST.u.uid(), tier, jobId: null, brokenUntil: 0 });
    AST.ui.dirty('garage');
  }

  function upgradeLift(bayId) {
    const S = AST.state;
    const bay = S.garage.bays.find((b) => b.id === bayId);
    if (!bay || bay.tier >= 3) return false;
    const cost = Math.round(AST.BAL.LIFT_TIER_COST[bay.tier] * S.inflation);
    if (!AST.econ.trySpend(cost, 'equip', 'Апгрейд подъёмника')) return false;
    bay.tier++;
    AST.audio.play('buy');
    AST.ui.toast('⬆️', `Подъёмник улучшен до уровня ${bay.tier}`, `+${Math.round((AST.BAL.LIFT_TIER_SPEED[bay.tier - 1] - 1) * 100)}% к скорости в этом боксе`, 'ok');
    AST.ui.dirty('garage');
    return true;
  }

  function sellBay(bayId) {
    const S = AST.state;
    if (S.garage.bays.length <= 1) return false;
    const bay = S.garage.bays.find((b) => b.id === bayId);
    if (!bay || bay.jobId) return false;
    const refund = Math.round(nextBayCost() * 0.45);
    S.garage.bays = S.garage.bays.filter((b) => b.id !== bayId);
    AST.econ.earn(refund, 'other', 'Продажа бокса');
    AST.ui.toast('💰', 'Бокс продан', `Возврат ${AST.u.fmt(refund)}`, 'ok');
    AST.ui.dirty('garage');
    return true;
  }

  /** Сломать случайный бокс на N часов (события) */
  function breakRandomBay(hours) {
    const S = AST.state;
    const bay = AST.u.pick(S.garage.bays);
    if (!bay) return;
    bay.brokenUntil = S.time.abs + hours * 60;
    AST.ui.dirty('garage');
  }

  /* ---------- Территория ---------- */

  const landMax = () => AST.BAL.LAND_COST.length - 1;

  function landCost() {
    const next = AST.state.garage.land + 1;
    return next > landMax() ? null : Math.round(AST.BAL.LAND_COST[next] * AST.state.inflation);
  }

  function buyLand() {
    const S = AST.state;
    const cost = landCost();
    if (cost == null) return false;
    if (!AST.econ.trySpend(cost, 'build', 'Расширение территории')) return false;
    S.garage.land++;
    AST.audio.play('achievement');
    AST.fx && AST.fx.confetti();
    AST.ui.toast('🗺️', 'Территория расширена!', `Максимум боксов: ${maxBays()}, построек: ${AST.BAL.LAND_FAC_CAP[S.garage.land]}`, 'gold');
    AST.ui.dirty('garage');
    return true;
  }

  /* ---------- Постройки ---------- */

  function facCount() {
    let n = 0;
    for (const f in AST.state.garage.fac) if (AST.state.garage.fac[f] > 0) n++;
    return n;
  }

  const facCap = () => AST.BAL.LAND_FAC_CAP[AST.state.garage.land] || 4;

  function facLevel(facId) {
    return AST.state.garage.fac[facId] || 0;
  }

  function buyFacility(facId) {
    const S = AST.state;
    const f = AST.data.facById[facId];
    if (!f) return false;
    const lvl = facLevel(facId);
    if (lvl >= 3) return false;
    if (lvl === 0 && facCount() >= facCap()) {
      AST.ui.toast('🏗️', 'Территория заполнена', 'Расширьте участок, чтобы строить больше', 'err');
      return false;
    }
    const cost = Math.round(f.costs[lvl] * S.inflation);
    if (!AST.econ.trySpend(cost, 'build', f.name)) return false;
    S.garage.fac[facId] = lvl + 1;
    AST._modsDirty = true;
    AST.audio.play('achievement');
    AST.fx && AST.fx.confetti();
    AST.ui.toast(f.ico, lvl === 0 ? `${f.name} — открыто!` : `${f.name} — уровень ${lvl + 1}`, f.desc, 'gold');
    AST.ui.dirty('garage');
    AST.scene && AST.scene.refresh();
    return true;
  }

  /* ---------- Пассивный доход построек ---------- */

  /** Доход постройки за час при текущих условиях */
  function facGainPerHour(f) {
    const S = AST.state;
    const lvl = facLevel(f.id);
    if (!lvl || !f.income) return 0;
    const m = AST.mods();
    let flow = AST.u.clamp(0.4 + S.rep / 120 + m.clients * 0.3, 0.4, 1.8);
    flow *= AST.time.weatherMult();
    let base = f.income[lvl - 1];
    // сезонность шиномонтажа: весна и зима — переобувка
    if (f.id === 'tire' && (S.time.season === 0 || S.time.season === 3)) base *= 1.6;
    // магазин зависит от ассортимента склада
    if (f.id === 'shop') {
      const kinds = Object.keys(S.inv).length;
      base *= AST.u.clamp(kinds / 30, 0.4, 1.6);
    }
    // нужный сотрудник удваивает эффективность
    let staffFactor = 1;
    if (f.staff) {
      const has = S.staff.some((s) => s.role === f.staff && !s.vacationUntil && !s.training);
      staffFactor = has ? 1 : 0.45;
    }
    return Math.round(base * flow * staffFactor * S.inflation * (1 + m.income * 0.5));
  }

  /** Суммарный пассив построек, $/час (для интерфейса) */
  function passivePerHour() {
    let sum = 0;
    for (const f of AST.data.facilities) sum += facGainPerHour(f);
    return sum;
  }

  /** Начисление раз в игровой час */
  function hourly() {
    if (!AST.time.isOpen()) return;
    for (const f of AST.data.facilities) {
      const gain = facGainPerHour(f);
      if (gain > 0) {
        AST.econ.earn(gain, 'service', f.name);
        if (f.counter) AST.addC(f.counter, AST.u.ri(1, 2));
        AST.scene && AST.scene.serviceCash(f.id, gain);
      }
    }
  }

  function newDay() {
    // место для ежедневной логики гаража (пока пусто)
  }

  return {
    maxBays, canAddBay, nextBayCost, buyBay, addBay, upgradeLift, sellBay,
    breakRandomBay, landMax, landCost, buyLand,
    facCount, facCap, facLevel, buyFacility, hourly, newDay,
    facGainPerHour, passivePerHour,
  };
})();
