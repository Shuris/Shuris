// Toasts e janelas modais.
import { esc } from '../dom';
import { t } from '../../i18n';

export function toast(message: string, kind: 'info' | 'good' | 'bad' | 'gold' = 'info', ms = 3200): void {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  root.appendChild(el);
  while (root.children.length > 4) root.firstElementChild?.remove();
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

export interface ModalOptions {
  onClose?: () => void;
  dismissable?: boolean;
  cls?: string;
}

let closeCurrent: (() => void) | null = null;

export function openModal(html: string, opts: ModalOptions = {}): HTMLElement {
  closeModal();
  const root = document.getElementById('modal-root')!;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal panel ${esc(opts.cls ?? '')}" role="dialog">${html}</div>`;
  root.appendChild(wrap);
  const close = () => {
    wrap.remove();
    if (closeCurrent === close) closeCurrent = null;
    opts.onClose?.();
  };
  closeCurrent = close;
  if (opts.dismissable !== false) {
    wrap.addEventListener('mousedown', (e) => {
      if (e.target === wrap) close();
    });
  }
  return wrap.querySelector('.modal') as HTMLElement;
}

export function closeModal(): void {
  closeCurrent?.();
}

export function hasModal(): boolean {
  return !!closeCurrent;
}

export function confirmModal(title: string, text: string, okLabel = t('common.confirm')): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const m = openModal(
      `<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="row end"><button class="btn" data-a="no">${t('common.cancel')}</button><button class="btn btn-red" data-a="ok">${esc(okLabel)}</button></div>`,
      { onClose: () => !answered && resolve(false) },
    );
    m.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
      if (!a) return;
      answered = true;
      closeModal();
      resolve(a === 'ok');
    });
  });
}
