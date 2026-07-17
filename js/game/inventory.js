/* ============================================================
   ИГРА: склад запчастей, заказы у поставщиков, автозаказ
   ============================================================ */
'use strict';

AST.inv = (() => {

  const qty = (pid) => AST.state.inv[pid] || 0;

  function totalQty() {
    let t = 0;
    for (const k in AST.state.inv) t += AST.state.inv[k];
    return t;
  }

  function totalValue() {
    let v = 0;
    for (const k in AST.state.inv) {
      const p = AST.data.partById[k];
      if (p) v += p.price * AST.state.inv[k];
    }
    return Math.round(v * AST.state.inflation);
  }

  const capacity = () => AST.BAL.STOCK_BASE + AST.mods().stockCap;

  /** Цена одной детали у поставщика (со скидками) */
  function price(pid, supId) {
    const p = AST.data.partById[pid];
    const sup = AST.data.supById[supId];
    if (!p || !sup) return 0;
    const rel = AST.state.supRel[supId] || 0;
    let val = p.price * sup.priceMult * AST.state.inflation;
    val *= (1 - AST.SUPPLIER_DISCOUNT(rel));
    val *= (1 - AST.mods().partsCost);
    return Math.max(1, Math.round(val));
  }

  /** Оформить заказ. items: {pid: qty}. Вернёт true при успехе */
  function order(supId, items) {
    const S = AST.state;
    const sup = AST.data.supById[supId];
    if (!sup) return false;
    let count = 0, cost = 0;
    for (const pid in items) {
      const n = items[pid];
      if (n <= 0) continue;
      count += n;
      cost += price(pid, supId) * n;
    }
    if (count === 0) return false;
    if (totalQty() + count > capacity()) {
      AST.ui.toast('📦', 'Склад переполнен', `Вместимость: ${capacity()}. Постройте склад побольше`, 'err');
      return false;
    }
    // бонус ИмпортТрейд: −10% от 10 позиций
    if (supId === 'imp' && count >= 10) cost = Math.round(cost * 0.9);
    if (!AST.econ.trySpend(cost, 'parts', `Заказ у «${sup.name}»`)) return false;

    const etaMin = Math.max(20, sup.deliveryH * 60 * (1 - AST.mods().delivery));
    S.orders.push({
      id: AST.u.uid(), supId,
      items: { ...items }, count, cost,
      etaMin, etaTotal: etaMin,
    });
    S.supRel[supId] = (S.supRel[supId] || 0) + count;
    AST.addC('orders');
    AST.addC('partsBought', count);   // «куплено» = оформлено (для миссий и ежедневок)
    AST.audio.play('buy');
    AST.ui.toast('🚚', 'Заказ оформлен', `${count} поз. • приедет через ${AST.u.fmtDur(etaMin)}`, 'ok');
    AST.ui.dirty('stock');
    return true;
  }

  /** Тик: движение заказов */
  function tick(dtMin) {
    const S = AST.state;
    if (!S.orders.length) return;
    let arrived = false;
    for (const o of S.orders) o.etaMin -= dtMin;
    const done = S.orders.filter((o) => o.etaMin <= 0);
    if (!done.length) return;
    S.orders = S.orders.filter((o) => o.etaMin > 0);

    for (const o of done) {
      const sup = AST.data.supById[o.supId];
      let got = 0, brak = 0;
      const brakChance = sup.quality >= 5 ? 0 : Math.max(0, (3.5 - sup.quality) * 0.03);
      for (const pid in o.items) {
        for (let i = 0; i < o.items[pid]; i++) {
          if (AST.u.chance(brakChance)) { brak++; continue; }
          if (totalQty() < capacity()) {
            S.inv[pid] = (S.inv[pid] || 0) + 1;
            got++;
          }
        }
      }
      arrived = true;
      if (brak > 0) {
        AST.ui.toast('📦', `Доставка от «${sup.name}»`, `Принято ${got} поз., брак: ${brak} 😠`, 'warn');
      } else {
        AST.ui.toast('📦', `Доставка от «${sup.name}»`, `Принято ${got} поз.`, 'ok');
      }
    }
    if (arrived) {
      AST.audio.play('notify');
      AST.ui.dirty('stock'); AST.ui.dirty('garage');
    }
  }

  /** Списать деталь под ремонт */
  function take(pid, n = 1) {
    const S = AST.state;
    if ((S.inv[pid] || 0) < n) return false;
    S.inv[pid] -= n;
    if (S.inv[pid] <= 0) delete S.inv[pid];
    AST.addC('partsUsed', n);
    return true;
  }

  /** Продать лишнее (50% цены) */
  function sell(pid, n = 1) {
    const S = AST.state;
    const p = AST.data.partById[pid];
    if (!p || (S.inv[pid] || 0) < n) return false;
    S.inv[pid] -= n;
    if (S.inv[pid] <= 0) delete S.inv[pid];
    AST.econ.earn(Math.round(p.price * 0.5 * n * S.inflation), 'shop', 'Продажа со склада');
    AST.audio.play('cash');
    return true;
  }

  /** Потерять случайные детали (пожар/кража). Вернёт количество */
  function loseRandom(frac) {
    const S = AST.state;
    let lost = 0, lostValue = 0;
    for (const pid in { ...S.inv }) {
      const n = Math.ceil(S.inv[pid] * frac * AST.u.rf(0.5, 1.5));
      const real = Math.min(n, S.inv[pid]);
      if (real > 0) {
        S.inv[pid] -= real;
        if (S.inv[pid] <= 0) delete S.inv[pid];
        lost += real;
        const p = AST.data.partById[pid];
        if (p) lostValue += p.price * real;
      }
    }
    if (S.flags.insurance && lostValue > 0) {
      const comp = Math.round(lostValue * 0.8 * S.inflation);
      AST.econ.earn(comp, 'insurance', 'Страховая выплата');
      AST.ui.toast('🛡️', 'Страховка сработала', `Компенсация ${AST.u.fmt(comp)}`, 'ok');
    }
    AST.ui.dirty('stock');
    return lost;
  }

  /** Автозаказ (исследование «Автозаказ деталей»): дозакажет недостающее */
  function autoReorder(pid, needQty = 1) {
    const S = AST.state;
    if (!AST.research.hasSp('autoorder')) return false;
    if (S.flags.autoOrderOff) return false;   // игрок выключил автозаказ
    // уже едет?
    for (const o of S.orders) if (o.items[pid]) return true;
    const supId = S.flags.autoSupplier || 'reg';
    const items = {}; items[pid] = Math.max(needQty, 2);
    return order(supId, items);
  }

  return { qty, totalQty, totalValue, capacity, price, order, tick, take, sell, loseRandom, autoReorder };
})();
