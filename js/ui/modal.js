/* ============================================================
   UI: модальные окна (никаких нативных alert/confirm!)
   ============================================================ */
'use strict';

AST.modal = (() => {
  const root = () => AST.u.byId('modal-root');

  /**
   * show({ico, title, body, buttons:[{label, primary, danger, gold, onClick}], locked, wide, onClose})
   * Возвращает функцию закрытия.
   */
  function show(opts) {
    const back = AST.u.el('div', 'modal-back');
    const modal = AST.u.el('div', 'modal' + (opts.wide ? ' wide' : ''));

    const head = AST.u.el('div', 'modal-head');
    head.appendChild(AST.u.el('div', 'modal-title', AST.u.esc(opts.title || '')));
    if (!opts.locked) {
      const x = AST.u.el('button', 'modal-x', '✕');
      x.onclick = () => close();
      head.appendChild(x);
    }
    modal.appendChild(head);

    const body = AST.u.el('div', 'modal-body');
    body.innerHTML = (opts.ico ? `<div class="modal-ico-big">${opts.ico}</div>` : '') + (opts.body || '');
    modal.appendChild(body);

    if (opts.buttons && opts.buttons.length) {
      const actions = AST.u.el('div', 'modal-actions');
      for (const b of opts.buttons) {
        const btn = AST.u.el('button',
          'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : '') + (b.gold ? ' gold' : ''),
          AST.u.esc(b.label));
        btn.onclick = () => { close(); if (b.onClick) b.onClick(); };
        actions.appendChild(btn);
      }
      modal.appendChild(actions);
    }

    back.appendChild(modal);
    if (!opts.locked) {
      back.addEventListener('click', (e) => { if (e.target === back) close(); });
    }
    root().appendChild(back);
    AST.audio.play('click');

    function close() {
      back.remove();
      if (opts.onClose) opts.onClose();
    }
    return close;
  }

  /** Подтверждение: Promise<boolean> */
  function confirm(title, bodyHtml, yesLabel = 'Да', noLabel = 'Отмена') {
    return new Promise((resolve) => {
      show({
        title,
        body: bodyHtml,
        locked: true,
        buttons: [
          { label: yesLabel, primary: true, onClick: () => resolve(true) },
          { label: noLabel, onClick: () => resolve(false) },
        ],
      });
    });
  }

  /** Ввод строки: Promise<string|null> */
  function prompt(title, placeholder = '', value = '') {
    return new Promise((resolve) => {
      const id = 'mp_' + AST.u.uid();
      const close = show({
        title,
        locked: true,
        body: `<input id="${id}" class="input" style="width:100%" maxlength="40"
                 placeholder="${AST.u.esc(placeholder)}" value="${AST.u.esc(value)}">`,
        buttons: [
          { label: 'Сохранить', primary: true, onClick: () => resolve((AST.u.byId(id) || {}).value || null) },
          { label: 'Отмена', onClick: () => resolve(null) },
        ],
      });
      setTimeout(() => { const inp = AST.u.byId(id); if (inp) { inp.focus(); inp.select(); } }, 60);
    });
  }

  return { show, confirm, prompt };
})();
