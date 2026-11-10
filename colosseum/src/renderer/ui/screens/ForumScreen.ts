// Fórum: as edições da Folha Diurna (jornal).
import type { Edition, PlayerState } from '../../core/model/types';
import { esc } from '../dom';
import type { Screen, ScreenDeps } from './Screen';

export function newspaperHtml(ed: Edition): string {
  const items = ed.items
    .map((n, i) => `<article class="${i === 0 ? 'lead' : ''} news-${n.kind}"><h3>${esc(n.headline)}</h3><p>${esc(n.body)}</p></article>`)
    .join('');
  return `<div class="newspaper">
    <header><div class="np-title">FOLHA DIURNA</div><div class="np-sub">Cápua · Dia ${ed.day}</div></header>
    ${items}
    <div class="row center"><button class="btn" data-np="close">Fechar</button></div>
  </div>`;
}

export class ForumScreen implements Screen {
  readonly id = 'forum' as const;
  readonly title = 'Fórum';
  readonly tip = 'O jornal sai toda manhã. Fique famoso para ser notícia!';

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    if (!p.news.editions.length) return '<p class="dim">Nenhuma edição ainda.</p>';
    return `<div class="editions">${p.news.editions
      .map(
        (e) => `<button class="edition ${e.read ? '' : 'unread'}" data-action="read" data-id="${e.day}">
          <span class="ed-day">Dia ${e.day}</span><span class="ed-head">${esc(e.items[0]?.headline ?? '')}</span>${e.read ? '' : '<span class="tag gold">nova</span>'}</button>`,
      )
      .join('')}</div>`;
  }

  onAction(action: string, el: HTMLElement): void {
    if (action === 'read') this.d.actions.readEdition(Number(el.dataset.id));
  }
}
