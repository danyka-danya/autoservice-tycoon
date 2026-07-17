/* ============================================================
   UI: визуальные эффекты — летящие деньги, конфетти, кольца
   ============================================================ */
'use strict';

AST.fx = (() => {
  const layer = () => AST.u.byId('fx-layer');

  /** Летящая сумма. Если координаты не заданы — у баланса в HUD */
  function money(amount, x, y) {
    const el = AST.u.el('div', 'fx-money' + (amount < 0 ? ' neg' : ''),
      (amount > 0 ? '+' : '−') + AST.u.fmt(Math.abs(amount)).replace('$', '$'));
    if (x == null) {
      const hud = AST.u.byId('hud-money-wrap');
      if (hud) {
        const r = hud.getBoundingClientRect();
        x = r.left + r.width / 2 + AST.u.ri(-20, 20);
        y = r.bottom + 6;
      } else { x = innerWidth / 2; y = 80; }
    }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    layer().appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  const CONF_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#ffd166', '#3b82f6'];

  /** Конфетти из центра экрана (или из точки) */
  function confetti(n = 36, cx, cy) {
    const L = layer();
    cx = cx == null ? innerWidth / 2 : cx;
    cy = cy == null ? innerHeight * 0.3 : cy;
    for (let i = 0; i < n; i++) {
      const p = AST.u.el('div', 'fx-conf');
      p.style.background = AST.u.pick(CONF_COLORS);
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.setProperty('--cx', AST.u.ri(-160, 160) + 'px');
      p.style.setProperty('--cy', AST.u.ri(60, 300) + 'px');
      p.style.animationDelay = (Math.random() * 0.15) + 's';
      L.appendChild(p);
      setTimeout(() => p.remove(), 1900);
    }
  }

  /** Расходящееся кольцо (покупки) */
  function ringAt(x, y) {
    x = x == null ? innerWidth / 2 : x;
    y = y == null ? innerHeight / 2 : y;
    const r = AST.u.el('div', 'fx-ring');
    const size = 90;
    r.style.left = (x - size / 2) + 'px';
    r.style.top = (y - size / 2) + 'px';
    r.style.width = size + 'px';
    r.style.height = size + 'px';
    layer().appendChild(r);
    setTimeout(() => r.remove(), 800);
  }

  return { money, confetti, ringAt };
})();
