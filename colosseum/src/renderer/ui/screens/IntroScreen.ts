// Primeira execução: apresentação → criação do gladiador → introdução → arena.
import type { Appearance } from '../../core/model/types';
import { CLOTH_COLORS, HAIR_COLORS, HAIR_STYLE_NAMES, ORIGINS, SKIN_NAMES } from '../../core/data/gladiators';
import { ATTRIBUTE_INFO } from '../../core/data/gladiators';
import { MAX_NAME_LENGTH, validateName } from '../../core/systems/PlayerFactory';
import type { AttributeKey } from '../../core/model/types';
import { esc } from '../dom';

export interface CreationResult {
  name: string;
  origin: string;
  appearance: Appearance;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const SKIN_SWATCH = ['#eebe94', '#c88e62', '#8c5c3c'];

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
          <p class="tagline">Roma, ano 80 d.C. As portas do anfiteatro se abrem.<br>Forje a carreira de um gladiador — da rúdis de madeira à glória da arena.</p>
          <button class="btn btn-red big" data-i="new">Iniciar carreira</button>
        </div>`;
      return;
    }
    if (this.step === 'create') {
      const swatch = (key: string, i: number, color: string, active: boolean, title: string) =>
        `<button class="swatch ${active ? 'active' : ''}" style="background:${color}" data-i="${key}" data-v="${i}" title="${esc(title)}"></button>`;
      const origins = ORIGINS.map((o) => {
        const bonus = Object.entries(o.bonus)
          .map(([k, v]) => `${ATTRIBUTE_INFO[k as AttributeKey].short} +${v}`)
          .join(', ');
        return `<button class="origin ${o.id === this.origin ? 'active' : ''}" data-i="origin" data-v="${o.id}"><b>${esc(o.name)}</b><span>${esc(o.description)}</span><em>${bonus}</em></button>`;
      }).join('');
      this.root.innerHTML = `
        <div class="create panel">
          <h2>Criação do gladiador</h2>
          <label class="field">Nome do gladiador
            <input name="gname" maxlength="${MAX_NAME_LENGTH}" autocomplete="off" spellcheck="false" placeholder="Ex.: Maximus" value="${esc(this.name)}">
          </label>
          <div class="form-error">${esc(this.error)}</div>
          <h3>Origem</h3>
          <div class="origins">${origins}</div>
          <h3>Aparência</h3>
          <div class="appear">
            <span>Pele</span><div>${SKIN_SWATCH.map((c, i) => swatch('skin', i, c, this.appearance.skin === i, SKIN_NAMES[i])).join('')}</div>
            <span>Cabelo</span><div>${HAIR_STYLE_NAMES.map((n, i) => `<button class="btn sm ${this.appearance.hairStyle === i ? 'active' : ''}" data-i="hairStyle" data-v="${i}">${esc(n)}</button>`).join('')}</div>
            <span>Cor do cabelo</span><div>${HAIR_COLORS.map((c, i) => swatch('hairColor', i, hex(c), this.appearance.hairColor === i, '')).join('')}</div>
            <span>Barba</span><div><button class="btn sm ${this.appearance.beard ? '' : 'active'}" data-i="beard" data-v="0">Sem barba</button><button class="btn sm ${this.appearance.beard ? 'active' : ''}" data-i="beard" data-v="1">Com barba</button></div>
            <span>Tanga (subligaculum)</span><div>${CLOTH_COLORS.map((c, i) => swatch('clothColor', i, hex(c), this.appearance.clothColor === i, '')).join('')}</div>
          </div>
          <div class="row end"><button class="btn btn-red" data-i="next">Continuar</button></div>
        </div>`;
      const input = this.root.querySelector<HTMLInputElement>('input[name="gname"]');
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
      return;
    }
    this.root.innerHTML = `
      <div class="story panel">
        <h2>Bem-vindo ao ludus, ${esc(this.name.trim())}</h2>
        <p>Você foi comprado por um lanista e agora treina no ludus para lutar no anfiteatro. Sua carreira é permanente: vitórias e derrotas fazem parte do caminho — ninguém morre nesta arena, mas a glória precisa ser conquistada.</p>
        <ul class="howto">
          <li><b>Arena:</b> escolha o adversário e a estratégia. A luta é automática — acompanhe e torça.</li>
          <li><b>Gladiador:</b> distribua os 3 pontos de atributo que você ganha a cada nível.</li>
          <li><b>Treinamento:</b> gaste moedas para aprimorar atributos aos poucos.</li>
          <li><b>Equipamentos:</b> compre e equipe armas, escudos e proteções.</li>
          <li><b>Modo companion:</b> o botão no topo transforma o jogo em uma janelinha flutuante para acompanhar as lutas enquanto usa o computador.</li>
        </ul>
        <p class="hint">Você começa com uma rúdis de madeira e 150 moedas. Uma boa ideia é comprar um escudo pequeno ou uma armadura leve antes da primeira luta.</p>
        <div class="row end"><button class="btn" data-i="back">Voltar</button><button class="btn btn-red" data-i="finish">Entrar na arena</button></div>
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
