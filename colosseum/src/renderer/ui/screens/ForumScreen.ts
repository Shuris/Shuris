// Fórum: as edições do Cápua Times (jornal da cidade).
import type { Edition, PlayerState } from '../../core/model/types';
import { newsBody, newsHeadline } from '../../core/systems/NewsSystem';
import { weekdayName } from '../../core/data/locations';
import { esc } from '../dom';
import { t, tk } from '../../i18n';
import type { Screen, ScreenDeps } from './Screen';

const ADS = 20;

/** Ano em algarismos romanos (o jogo se passa no ano DCCCXXX da fundação de Roma). */
function roman(n: number): string {
  const map: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of map) while (n >= v) (out += s), (n -= v);
  return out;
}

export function newspaperHtml(ed: Edition): string {
  const [lead, ...rest] = ed.items;
  const figure = (img: string | undefined, cls: string) =>
    img ? `<figure class="np-fig ${cls}"><img src="assets/news/${esc(img)}.png" alt="" draggable="false"><figcaption>${esc(tk(`news.img.${img}`))}</figcaption></figure>` : '';
  const article = (n: (typeof ed.items)[number], cls: string) =>
    `<article class="${cls} news-${n.kind}">${figure(n.img, cls === 'lead' ? 'big' : 'small')}<h3>${esc(newsHeadline(n))}</h3><p>${esc(newsBody(n))}</p></article>`;
  const ad = tk(`ad.${ed.day % ADS}`);
  return `<div class="newspaper">
    <header>
      <div class="np-top"><span>${t('np.price')}</span><span>${t('np.edition', { n: ed.day })}</span><span>${t('np.year', { y: roman(830 + Math.floor((ed.day - 1) / 365)) })}</span></div>
      <div class="np-title">${t('np.title')}</div>
      <div class="np-sub"><span>${esc(weekdayName(ed.day))}, ${t('common.dayN', { n: ed.day })}</span><span class="np-motto">${t('np.motto')}</span></div>
    </header>
    ${lead ? article(lead, 'lead') : ''}
    <div class="np-cols">${rest.map((n) => article(n, '')).join('')}
      <aside class="np-ad"><b>${t('np.ad')}</b><p>${esc(ad)}</p></aside>
    </div>
    <div class="row center"><button class="btn" data-np="close">${t('common.close')}</button></div>
  </div>`;
}

export class ForumScreen implements Screen {
  readonly id = 'forum' as const;
  get title() {
    return t('forum.title');
  }
  get tip() {
    return t('forum.tip');
  }

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    if (!p.news.editions.length) return `<p class="dim">${t('forum.none')}</p>`;
    return `<div class="editions">${p.news.editions
      .map(
        (e) => `<button class="edition ${e.read ? '' : 'unread'}" data-action="read" data-id="${e.day}">
          <span class="ed-day">${t('common.dayN', { n: e.day })}</span><span class="ed-head">${esc(e.items[0] ? newsHeadline(e.items[0]) : '')}</span>${e.read ? '' : `<span class="tag gold">${t('forum.new')}</span>`}</button>`,
      )
      .join('')}</div>`;
  }

  onAction(action: string, el: HTMLElement): void {
    if (action === 'read') this.d.actions.readEdition(Number(el.dataset.id));
  }
}
