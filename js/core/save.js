/* ============================================================
   ЯДРО: сохранения (LocalStorage) + офлайн-прогресс
   ============================================================ */
'use strict';

AST.save = (() => {
  const KEY = 'ast_autoservice_save';
  let lastAuto = 0;

  function save(manual = false) {
    try {
      AST.state.meta.lastSave = Date.now();
      localStorage.setItem(KEY, JSON.stringify(AST.state));
      if (manual && AST.ui) AST.ui.toast('💾', 'Игра сохранена', '', 'ok');
      return true;
    } catch (e) {
      if (manual && AST.ui) AST.ui.toast('⚠️', 'Не удалось сохранить', String(e.message || e), 'err');
      return false;
    }
  }

  /** Автосохранение раз в 20 секунд реального времени */
  function autoTick() {
    if (!AST.state.settings.autosave) return;
    const now = Date.now();
    if (now - lastAuto > 20000) { lastAuto = now; save(false); }
  }

  function hasSave() {
    return !!localStorage.getItem(KEY);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // мягкая миграция: новые поля дефолта подмешиваются к сохранению
      const merged = AST.u.deepMerge(AST.newState(), parsed);
      // страховка формата незавершённых работ (обновления игры)
      merged.jobs = (merged.jobs || []).filter((j) => j && j.client && j.client.faults);
      merged.jobs.forEach((j) => {
        if (!Array.isArray(j.doneIdx)) j.doneIdx = [];
        if (!Array.isArray(j.skipIdx)) j.skipIdx = [];
        if (j.partsCost == null) j.partsCost = 0;
        if (j.waitedPartMin == null) j.waitedPartMin = 0;
      });
      // личная статистика сотрудников (появилась в обновлении)
      (merged.staff || []).forEach((st) => {
        if (!st.stats) st.stats = { earned: 0, repairs: 0, fivestars: 0 };
      });
      return merged;
    } catch (e) {
      console.warn('Битое сохранение', e);
      return null;
    }
  }

  function reset() {
    localStorage.removeItem(KEY);
    location.reload();
  }

  /* --- перекодировка байтов в base64 (частями, чтобы не упасть на больших сейвах) --- */
  function b64FromBytes(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function bytesFromB64(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** Компактный код сохранения (gzip, в ~8 раз короче). Асинхронный */
  async function exportStr() {
    const json = JSON.stringify(AST.state);
    try {
      if (window.CompressionStream) {
        const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
        const buf = await new Response(stream).arrayBuffer();
        return 'AST1.' + b64FromBytes(new Uint8Array(buf));
      }
    } catch (e) { /* нет поддержки — обычный формат */ }
    return btoa(unescape(encodeURIComponent(json)));
  }

  /** Импорт: понимает и новый сжатый формат, и старый длинный */
  async function importStr(str) {
    try {
      str = String(str).trim().replace(/\s+/g, '');
      let json;
      if (str.startsWith('AST1.')) {
        const ds = new Blob([bytesFromB64(str.slice(5))]).stream()
          .pipeThrough(new DecompressionStream('gzip'));
        json = await new Response(ds).text();
      } else {
        json = decodeURIComponent(escape(atob(str)));
      }
      const parsed = JSON.parse(json);
      if (!parsed || !parsed.meta || !parsed.time) return false;
      localStorage.setItem(KEY, JSON.stringify(AST.u.deepMerge(AST.newState(), parsed)));
      location.reload();
      return true;
    } catch (e) { return false; }
  }

  /** Скачать сохранение файлом (для пересылки одним вложением) */
  async function exportFile() {
    const code = await exportStr();
    const blob = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `автосервис-день${AST.state.time.day}.save.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /** Офлайн-доход: пока игрока не было, сервис «работал вполсилы» */
  function offlineReport() {
    const S = AST.state;
    const awayMs = Date.now() - (S.meta.lastSave || Date.now());
    const awayH = awayMs / 3600000;
    if (awayH < 0.2 || S.history.length === 0) return null;
    const last = S.history[S.history.length - 1];
    if (!last || last.profit <= 0) return null;
    const hours = Math.min(awayH, 12);                       // не больше 12 часов
    const gain = Math.round((last.profit / 24) * hours * 0.3); // 30% КПД без владельца
    if (gain < 10) return null;
    AST.econ.earn(gain, 'other', 'Работа без владельца');
    return { hours, gain };
  }

  return { save, autoTick, hasSave, load, reset, exportStr, importStr, exportFile, offlineReport, KEY };
})();
