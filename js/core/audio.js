/* ============================================================
   ЯДРО: звук.
   Работает без файлов — все эффекты синтезируются WebAudio.
   Если положить mp3/ogg в assets/audio/ с нужными именами
   (см. assets/audio/README.md) — будут играть файлы.
   ============================================================ */
'use strict';

AST.audio = (() => {
  let ctx = null;
  let files = {};          // имя → HTMLAudio (если файл найден)
  let musicEl = null;      // фоновая музыка, если есть файл
  const FILE_NAMES = ['cash', 'click', 'buy', 'error', 'level', 'car_in', 'car_out', 'repair', 'wrench', 'achievement', 'chest', 'event', 'notify'];

  const on = () => AST.state && AST.state.settings.sound;
  const musicOn = () => AST.state && AST.state.settings.music;

  function ensureCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* нет WebAudio — молчим */ }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /** Пробуем подхватить внешние файлы (тихо, без ошибок в консоль) */
  function init() {
    FILE_NAMES.forEach((name) => {
      const a = new Audio();
      a.src = `assets/audio/${name}.mp3`;
      a.preload = 'auto';
      a.addEventListener('canplaythrough', () => { files[name] = a; }, { once: true });
      a.addEventListener('error', () => {}, { once: true });
    });
    const m = new Audio();
    m.src = 'assets/audio/music.mp3';
    m.loop = true; m.volume = 0.35;
    m.addEventListener('canplaythrough', () => { musicEl = m; tryMusic(); }, { once: true });
    m.addEventListener('error', () => {}, { once: true });
    // разблокировка аудио по первому действию пользователя
    const unlock = () => { ensureCtx(); tryMusic(); };
    window.addEventListener('pointerdown', unlock, { once: true });
  }

  function tryMusic() {
    if (musicEl && musicOn()) musicEl.play().catch(() => {});
  }
  function stopMusic() { if (musicEl) musicEl.pause(); }

  /** Один синтезированный тон */
  function tone(freq, dur, type = 'sine', vol = 0.12, delay = 0) {
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  /** Шумовой всплеск (для «инструментов») */
  function noise(dur = 0.08, vol = 0.05, delay = 0) {
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(c.destination);
    src.start(t0);
  }

  /* Рецепты синтезированных звуков */
  const SYNTH = {
    click:       () => tone(720, 0.05, 'triangle', 0.07),
    cash:        () => { tone(880, 0.07, 'sine', 0.1); tone(1320, 0.12, 'sine', 0.1, 0.06); },
    buy:         () => { tone(520, 0.08, 'triangle', 0.1); tone(780, 0.1, 'triangle', 0.09, 0.07); },
    error:       () => { tone(220, 0.14, 'sawtooth', 0.07); tone(180, 0.18, 'sawtooth', 0.06, 0.1); },
    level:       () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'triangle', 0.1, i * 0.09)); },
    achievement: () => { [659, 784, 988, 1318].forEach((f, i) => tone(f, 0.16, 'sine', 0.1, i * 0.1)); },
    chest:       () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'triangle', 0.09, i * 0.07)); },
    car_in:      () => { tone(140, 0.25, 'sawtooth', 0.05); tone(110, 0.3, 'sawtooth', 0.04, 0.12); },
    car_out:     () => { tone(160, 0.2, 'sawtooth', 0.05); tone(220, 0.22, 'sawtooth', 0.04, 0.1); },
    repair:      () => { noise(0.06, 0.05); noise(0.05, 0.04, 0.1); },
    wrench:      () => { tone(1400, 0.03, 'square', 0.04); noise(0.04, 0.035, 0.02); },
    event:       () => { tone(660, 0.12, 'sine', 0.09); tone(495, 0.16, 'sine', 0.08, 0.1); },
    notify:      () => { tone(990, 0.09, 'sine', 0.08); },
  };

  /** Главная точка входа: AST.audio.play('cash') */
  function play(name) {
    if (!on()) return;
    try {
      if (files[name]) {
        const a = files[name].cloneNode();
        a.volume = 0.5;
        a.play().catch(() => {});
      } else if (SYNTH[name]) {
        SYNTH[name]();
      }
    } catch (e) { /* звук не критичен */ }
  }

  return { init, play, tryMusic, stopMusic };
})();
