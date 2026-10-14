import { esc } from '../lib/scale';
import { paint } from '../core/paint';

export interface Modal {
  kind?: 'msg' | 'ask';
  title?: string;
  text?: string;
  icon?: string;
  value?: string;
  placeholder?: string;
  onok?: (v: string) => void;
  // a two-button message: `okText` runs onok, `cancelText` (closing it any other way too) runs oncancel
  okText?: string;
  cancelText?: string;
  oncancel?: () => void;
}

let MODAL: Modal | null = null;

export function dialog(o: Modal): void {
  MODAL = Object.assign({ kind: 'msg' }, o);
  paint(true);
  setTimeout(() => {
    const i = document.getElementById('mdin') as HTMLInputElement | null;
    if (i) {
      i.focus();
      i.select();
    }
  }, 30);
}

export function closeModal(): void {
  MODAL = null;
  paint(true);
}

// closes without confirming: the cross, the cancel button or a tap on the shade
export function cancelModal(): void {
  const cb = MODAL?.oncancel;
  closeModal();
  if (cb) cb();
}

export function takeModalOk(): ((v: string) => void) | undefined {
  return MODAL?.onok;
}

export function modalHtml(): string {
  if (!MODAL) return '';
  const m = MODAL;
  return `<div class="shade" data-shade></div>
  <div class="modal">
    <div class="bar"><div class="lines"><span>${esc(m.title || 'система')}</span></div><button class="x" data-mclose="1">x</button></div>
    <div class="mbody">
      ${m.icon ? `<div class="micon">${m.icon}</div>` : ''}
      <div class="mtext">${esc(m.text || '')}</div>
      ${m.kind === 'ask' ? `<input class="answ" id="mdin" value="${esc(m.value || '')}" placeholder="${esc(m.placeholder || '')}" autocomplete="off" spellcheck="false" autocapitalize="off">` : ''}
      <div class="rowb">
        ${
          m.kind === 'ask'
            ? '<button class="btn p" data-mok="1">Сохранить</button><button class="btn" data-mclose="1">Отмена</button>'
            : m.okText
              ? `<button class="btn p" data-mok="1">${esc(m.okText)}</button><button class="btn" data-mclose="1">${esc(m.cancelText || 'Отмена')}</button>`
              : '<button class="btn p" data-mclose="1">Понятно</button>'
        }
      </div>
    </div>
  </div>`;
}
