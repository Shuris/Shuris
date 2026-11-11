// Primeira execução: apresentação → criação do gladiador → introdução → arena.
import type { Appearance } from '../../core/model/types';
import { CLOTH_COLORS, HAIR_COLORS, HAIR_STYLE_NAMES, ORIGINS } from '../../core/data/gladiators';
import { MAX_NAME_LENGTH, validateName } from '../../core/systems/PlayerFactory';
import type { AttributeKey } from '../../core/model/types';
import { esc } from '../dom';
import { getLang, t, type Lang } from '../../i18n';
import { attrShort, hairName, originDesc, originName, skinName } from '../../i18n/data';

export interface CreationResult {
  name: string;
  origin: string;
  appearance: Appearance;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const SKIN_SWATCH = ['#eebe94', '#c88e62', '#8c5c3c', '#fad8ba', '#623e28'];

export class IntroScreen {
  private step: 'title' | 'create' | 'story' = 'title';
  private name = '';
  private origin = ORIGINS[0].id;
  private appearance: Appearance = { skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 };
  private error = '';

  constructor(
    private readonly root: HTMLElement,
    private readonly onPreview: (a: Appearance) => void,
    private readonly onDone: (r: CreationResult) => void,
    private readonly onLang: (l: Lang) => void = () => {},
  ) {
    root.addEventListener('click', (e) => this.click(e));
    root.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.name === 'gname') {
        this.name = t.value;
        this.error = '';
        const err = root.querySelector('.form-error');
        if (err) err.textContent = '';
      }
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.target as HTMLElement).getAttribute('name') === 'gname') this.next();
    });
  }

  start(): void {
    this.root.hidden = false;
    this.step = 'title';
    this.render();
  }

  /** Redesenha no idioma atual (troca de idioma na tela inicial). */
  rerender(): void {
    if (!this.root.hidden) this.render();
  }

  close(): void {
    this.root.hidden = true;
    this.root.innerHTML = '';
  }

  private render(): void {
    this.root.className = `intro intro-${this.step}`;
    if (this.step === 'title') {
      this.root.innerHTML = `
        <div class="title-screen">
          <img class="title-icon" src="assets/ui/app-icon.png" alt="">
          <h1 class="logo">COLOSSEUM</h1>
          <p class="tagline">${t('intro.tagline')}</p>
          <button class="btn btn-red big" data-i="new">${t('intro.start')}</button>
          <div class="lang-pick"><button class="btn sm ${getLang() === 'pt' ? 'active' : ''}" data-i="lang" data-v="pt">Português</button><button class="btn sm ${getLang() === 'en' ? 'active' : ''}" data-i="lang" data-v="en">English</button></div>
        </div>`;
      return;
    }
    if (this.step === 'create') {
      const swatch = (key: string, i: number, color: string, active: boolean, title: string) =>
        `<button class="swatch ${active ? 'active' : ''}" style="background:${color}" data-i="${key}" data-v="${i}" title="${esc(title)}"></button>`;
      const origins = ORIGINS.map((o) => {
        const bonus = Object.entries(o.bonus)
          .map(([k, v]) => `${attrShort(k as AttributeKey)} +${v}`)
          .join(', ');
        return `<button class="origin ${o.id === this.origin ? 'active' : ''}" data-i="origin" data-v="${o.id}" title="${esc(originDesc(o))}"><b>${esc(originName(o))}</b><em>${bonus}</em></button>`;
      }).join('');
      this.root.innerHTML = `
        <div class="create panel">
          <h2>${t('intro.yourGladiator')}</h2>
          <label class="field">${t('intro.name')}
            <input name="gname" maxlength="${MAX_NAME_LENGTH}" autocomplete="off" spellcheck="false" placeholder="${t('intro.namePlaceholder')}" value="${esc(this.name)}">
          </label>
          <div class="form-error">${esc(this.error)}</div>
          <h3>${t('intro.origin')}</h3>
          <div class="origins">${origins}</div>
          <h3>${t('intro.look')}</h3>
          <div class="appear">
            <span>${t('intro.skin')}</span><div>${SKIN_SWATCH.map((c, i) => swatch('skin', i, c, this.appearance.skin === i, skinName(i))).join('')}</div>
            <span>${t('intro.hair')}</span><div>${HAIR_STYLE_NAMES.map((_n, i) => `<button class="btn sm ${this.appearance.hairStyle === i ? 'active' : ''}" data-i="hairStyle" data-v="${i}">${esc(hairName(i))}</button>`).join('')}</div>
            <span>${t('intro.color')}</span><div>${HAIR_COLORS.map((c, i) => swatch('hairColor', i, hex(c), this.appearance.hairColor === i, '')).join('')}</div>
            <span>${t('intro.beard')}</span><div><button class="btn sm ${this.appearance.beard ? '' : 'active'}" data-i="beard" data-v="0">${t('intro.noBeard')}</button><button class="btn sm ${this.appearance.beard ? 'active' : ''}" data-i="beard" data-v="1">${t('intro.withBeard')}</button></div>
            <span>${t('intro.cloth')}</span><div>${CLOTH_COLORS.map((c, i) => swatch('clothColor', i, hex(c), this.appearance.clothColor === i, '')).join('')}</div>
          </div>
          <div class="row end"><button class="btn btn-red" data-i="next">${t('common.continue')}</button></div>
        </div>`;
      const input = this.root.querySelector<HTMLInputElement>('input[name="gname"]');
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
      return;
    }
    this.root.innerHTML = `
      <div class="story panel">
        <h2>${t('intro.welcome', { name: esc(this.name.trim()) })}</h2>
        <ul class="howto">
          <li>${t('intro.how1')}</li>
          <li>${t('intro.how2')}</li>
          <li>${t('intro.how3')}</li>
        </ul>
        <p class="hint">${t('intro.hint')}</p>
        <div class="row end"><button class="btn" data-i="back">${t('common.back')}</button><button class="btn btn-red" data-i="finish">${t('intro.begin')}</button></div>
      </div>`;
  }

  private next(): void {
    const err = validateName(this.name);
    if (err) {
      this.error = err;
      this.render();
      return;
    }
    this.step = 'story';
    this.render();
  }

  private click(e: Event): void {
    const el = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
    if (!el) return;
    const v = el.dataset.v ?? '';
    switch (el.dataset.i) {
      case 'new':
        this.step = 'create';
        this.onPreview(this.appearance);
        break;
      case 'origin':
        this.origin = v;
        break;
      case 'lang':
        this.onLang(v === 'en' ? 'en' : 'pt');
        return;
      case 'skin':
      case 'hairStyle':
      case 'hairColor':
      case 'clothColor':
        this.appearance = { ...this.appearance, [el.dataset.i]: Number(v) };
        this.onPreview(this.appearance);
        break;
      case 'beard':
        this.appearance = { ...this.appearance, beard: v === '1' };
        this.onPreview(this.appearance);
        break;
      case 'next':
        this.next();
        return;
      case 'back':
        this.step = 'create';
        break;
      case 'finish':
        this.onDone({ name: this.name, origin: this.origin, appearance: this.appearance });
        return;
      default:
        return;
    }
    this.render();
  }
}
