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

  function exportStr() {
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(AST.state)))); }
    catch (e) { return ''; }
  }

  function importStr(str) {
    try {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
      if (!parsed || !parsed.meta || !parsed.time) return false;
      localStorage.setItem(KEY, JSON.stringify(AST.u.deepMerge(AST.newState(), parsed)));
      location.reload();
      return true;
    } catch (e) { return false; }
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

  return { save, autoTick, hasSave, load, reset, exportStr, importStr, offlineReport, KEY };
})();
