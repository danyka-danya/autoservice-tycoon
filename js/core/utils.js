/* ============================================================
   ЯДРО: утилиты и общий неймспейс AST (AutoService Tycoon)
   Все модули игры регистрируются в window.AST.
   ============================================================ */
'use strict';

window.AST = window.AST || { data: {}, panels: {} };

AST.u = (() => {

  let _uid = 1;

  /** Ограничить значение диапазоном */
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  /** Линейная интерполяция */
  const lerp = (a, b, t) => a + (b - a) * t;

  /** Случайное целое [a; b] включительно */
  const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  /** Случайное дробное [a; b) */
  const rf = (a, b) => Math.random() * (b - a) + a;

  /** Случайный элемент массива */
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /** Шанс: вернёт true с вероятностью p (0..1) */
  const chance = (p) => Math.random() < p;

  /** Взвешенный выбор: items — массив, wfn(item) — вес */
  function pickW(items, wfn) {
    let total = 0;
    for (const it of items) total += Math.max(0, wfn(it));
    if (total <= 0) return items[0];
    let roll = Math.random() * total;
    for (const it of items) {
      roll -= Math.max(0, wfn(it));
      if (roll <= 0) return it;
    }
    return items[items.length - 1];
  }

  /** Перемешать копию массива */
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /** Уникальный id */
  const uid = () => (Date.now().toString(36) + (_uid++).toString(36) + Math.random().toString(36).slice(2, 6));

  /** Деньги: $1.2M, $340K, $95 */
  function fmt(n) {
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (n >= 1e9) s = (n / 1e9).toFixed(n >= 1e10 ? 1 : 2) + 'B';
    else if (n >= 1e6) s = (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M';
    else if (n >= 1e4) s = (n / 1e3).toFixed(1) + 'K';
    else s = Math.round(n).toLocaleString('ru-RU');
    return (neg ? '-$' : '$') + s;
  }

  /** Деньги полностью: $1 234 567 */
  const fmtFull = (n) => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('ru-RU');

  /** Число коротко (без $) */
  function fmtN(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return Math.round(n).toLocaleString('ru-RU');
  }

  /** Минуты игры → «2ч 30м» */
  function fmtDur(min) {
    min = Math.max(0, Math.round(min));
    const h = Math.floor(min / 60), m = min % 60;
    if (h > 0 && m > 0) return `${h}ч ${m}м`;
    if (h > 0) return `${h}ч`;
    return `${m}м`;
  }

  /** Минута дня → «08:35» */
  function fmtClock(minOfDay) {
    const h = Math.floor(minOfDay / 60) % 24, m = Math.floor(minOfDay % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  /** Русские множественные формы: plural(5, 'день','дня','дней') */
  function plural(n, one, few, many) {
    n = Math.abs(Math.round(n)) % 100;
    if (n >= 11 && n <= 14) return many;
    switch (n % 10) {
      case 1: return one;
      case 2: case 3: case 4: return few;
      default: return many;
    }
  }

  /** Экранирование HTML */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  /** Быстрое создание DOM-элемента */
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  const byId = (id) => document.getElementById(id);

  /** Звёзды рейтинга «★★★☆☆» */
  const stars = (n) => '★'.repeat(Math.round(clamp(n, 0, 5))) + '☆'.repeat(5 - Math.round(clamp(n, 0, 5)));

  /** Процент со знаком: +15% / −8% */
  const pctS = (v) => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v * 100)) + '%';

  /** Глубокое слияние сохранения с дефолтом (default ← saved) */
  function deepMerge(def, saved) {
    if (saved == null) return def;
    if (def == null) return saved;
    if (Array.isArray(def) || Array.isArray(saved)) return saved;
    if (typeof def !== 'object' || typeof saved !== 'object') return saved;
    const out = {};
    for (const k of Object.keys(def)) out[k] = deepMerge(def[k], saved[k]);
    for (const k of Object.keys(saved)) if (!(k in def)) out[k] = saved[k];
    return out;
  }

  return { clamp, lerp, ri, rf, pick, chance, pickW, shuffle, uid, fmt, fmtFull, fmtN, fmtDur, fmtClock, plural, esc, el, byId, stars, pctS, deepMerge };
})();
