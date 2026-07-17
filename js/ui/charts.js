/* ============================================================
   UI: лёгкие canvas-графики (линии и столбцы) без библиотек
   ============================================================ */
'use strict';

AST.charts = (() => {

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(10, rect.width * dpr);
    canvas.height = Math.max(10, rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: rect.height };
  }

  function themeColors() {
    const dark = document.body.dataset.theme !== 'light';
    return {
      grid: dark ? 'rgba(255,255,255,.07)' : 'rgba(20,40,80,.08)',
      text: dark ? 'rgba(200,210,230,.7)' : 'rgba(60,80,110,.8)',
    };
  }

  /**
   * Линейный график.
   * series: [{data: number[], color, fill?}], labels: string[]
   */
  function line(canvas, series, labels = []) {
    const { ctx, w, h } = setupCanvas(canvas);
    const t = themeColors();
    const padL = 44, padR = 8, padT = 10, padB = 20;
    const pw = w - padL - padR, ph = h - padT - padB;

    let min = Infinity, max = -Infinity, len = 0;
    for (const s of series) {
      len = Math.max(len, s.data.length);
      for (const v of s.data) { if (v < min) min = v; if (v > max) max = v; }
    }
    if (!isFinite(min)) { min = 0; max = 1; }
    if (min === max) { min -= 1; max += 1; }
    if (min > 0) min = 0;

    const X = (i) => padL + (len <= 1 ? pw / 2 : (i / (len - 1)) * pw);
    const Y = (v) => padT + ph - ((v - min) / (max - min)) * ph;

    // сетка + подписи оси Y
    ctx.strokeStyle = t.grid;
    ctx.fillStyle = t.text;
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const v = min + ((max - min) * g) / 4;
      const y = Y(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(AST.u.fmtN(v), padL - 6, y + 3);
    }
    // подписи X (первая/середина/последняя)
    if (labels.length) {
      ctx.textAlign = 'center';
      const pick = [0, Math.floor(labels.length / 2), labels.length - 1];
      for (const i of pick) {
        if (labels[i] != null) ctx.fillText(String(labels[i]), X(i), h - 6);
      }
    }

    for (const s of series) {
      if (!s.data.length) continue;
      // заливка
      if (s.fill !== false) {
        const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
        grad.addColorStop(0, s.color + '55');
        grad.addColorStop(1, s.color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(X(0), Y(s.data[0]));
        for (let i = 1; i < s.data.length; i++) ctx.lineTo(X(i), Y(s.data[i]));
        ctx.lineTo(X(s.data.length - 1), h - padB);
        ctx.lineTo(X(0), h - padB);
        ctx.closePath();
        ctx.fill();
      }
      // линия
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(X(0), Y(s.data[0]));
      for (let i = 1; i < s.data.length; i++) ctx.lineTo(X(i), Y(s.data[i]));
      ctx.stroke();
      // точка на конце
      const lastX = X(s.data.length - 1), lastY = Y(s.data[s.data.length - 1]);
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(lastX, lastY, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** Столбчатая диаграмма. data: [{label, value, color}] */
  function bars(canvas, data) {
    const { ctx, w, h } = setupCanvas(canvas);
    const t = themeColors();
    const padL = 44, padR = 8, padT = 10, padB = 34;
    const pw = w - padL - padR, ph = h - padT - padB;
    const max = Math.max(1, ...data.map((d) => d.value));

    ctx.strokeStyle = t.grid;
    ctx.fillStyle = t.text;
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    for (let g = 0; g <= 4; g++) {
      const v = (max * g) / 4;
      const y = padT + ph - (v / max) * ph;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(AST.u.fmtN(v), padL - 6, y + 3);
    }

    const bw = Math.min(46, (pw / data.length) * 0.62);
    data.forEach((d, i) => {
      const cx = padL + (pw / data.length) * (i + 0.5);
      const bh = (d.value / max) * ph;
      const grad = ctx.createLinearGradient(0, padT + ph - bh, 0, padT + ph);
      grad.addColorStop(0, d.color);
      grad.addColorStop(1, d.color + '77');
      ctx.fillStyle = grad;
      const x = cx - bw / 2, y = padT + ph - bh;
      const r = Math.min(6, bw / 2);
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.arcTo(x + bw, y, x + bw, y + r, r);
      ctx.lineTo(x + bw, padT + ph);
      ctx.lineTo(x, padT + ph);
      ctx.closePath();
      ctx.fill();
      // подпись
      ctx.fillStyle = t.text;
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(cx, h - 6);
      ctx.fillText(d.label.length > 9 ? d.label.slice(0, 8) + '…' : d.label, 0, 0);
      ctx.restore();
    });
  }

  return { line, bars };
})();
