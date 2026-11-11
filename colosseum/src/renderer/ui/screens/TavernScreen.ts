// Taverna do Javali: comida, vinho com boatos sobre o próximo rival e conversa.
import type { PlayerState } from '../../core/model/types';
import { MEAL_ENERGY, MEAL_MINUTES, RUMOR_COST, RUMOR_MINUTES, canEat, canHearRumor, mealCost } from '../../core/systems/TavernSystem';
import { nextRival } from '../../core/systems/NewsSystem';
import { ARM_END, ARM_START, armFee, armPrize, canArmWrestle, isArmNight } from '../../core/systems/EventSystem';
import { isSunday } from '../../core/data/locations';
import { esc, icon } from '../dom';
import { getOpponent } from '../../core/data/opponents';
import { FRIEND_RESPECT, respectOf } from '../../core/systems/DuoSystem';
import { portrait } from '../components/portraits';
import { t } from '../../i18n';
import type { Screen, ScreenDeps } from './Screen';

export class TavernScreen implements Screen {
  readonly id = 'tavern' as const;
  get title() {
    return t('tavern.title');
  }
  get tip() {
    return t('tavern.tip');
  }
  /** última fala ouvida (aparece no painel e no balão da cena) */
  last: { who: string; text: string } | null = null;

  constructor(private readonly d: ScreenDeps) {}

  onOpen(): void {
    this.last = null;
  }

  render(p: PlayerState): string {
    const eatErr = canEat(p);
    const rumorErr = canHearRumor(p);
    const rival = nextRival(p);
    const say = this.last ?? { who: t('tavern.keeperName'), text: t('tavern.greet', { name: p.name }) };
    const card = (action: string, title: string, desc: string, btn: string, err: string | null) => `<div class="card tavern-card">
        <div class="row between"><b>${title}</b></div>
        <p class="tiny dim">${desc}</p>
        <button class="btn btn-gold wide" data-action="${action}" ${err ? `disabled title="${esc(err)}"` : ''}>${btn}</button>
        ${err ? `<p class="tiny red">${esc(err)}</p>` : ''}
      </div>`;
    return `<div class="monk-say tavern-say"><b>${esc(say.who)}:</b><span>“${esc(say.text)}”</span></div>
      ${card('eat', t('tavern.meal'), t('tavern.mealDesc', { energy: MEAL_ENERGY, min: MEAL_MINUTES }), `${t('tavern.eat')} ${icon('coin', 'xs')} ${mealCost(p)}`, eatErr)}
      ${card('rumor', t('tavern.wine'), t('tavern.wineDesc', { rival: rival.name, min: RUMOR_MINUTES }), `${t('tavern.listen')} ${icon('coin', 'xs')} ${RUMOR_COST}`, rumorErr)}
      ${this.armCard(p)}
      ${this.drinkCard(p)}`;
  }

  /** Queda de braço: domingo à noite (19h–23h), uma vez por domingo. */
  private armCard(p: PlayerState): string {
    const night = isArmNight(p.day, p.minutes);
    const err = canArmWrestle(p);
    const when = t('event.armWhen', { from: ARM_START / 60, to: ARM_END / 60 });
    if (!night) return `<div class="card tavern-card dim-card"><b>${t('event.armTitle')}</b><p class="tiny dim">${isSunday(p.day) ? when : t('event.armOnlySunday', { when })}</p></div>`;
    return `<div class="card tavern-card arm-card">
        <div class="row between"><b>${t('event.armTitle')}</b><span class="tag gold">${t('event.armTonight')}</span></div>
        <p class="tiny dim">${t('event.armDesc', { prize: armPrize(p) })}</p>
        <button class="btn btn-red wide" data-action="arm" ${err ? `disabled title="${esc(err)}"` : ''}>${t('event.armJoin')} ${icon('coin', 'xs')} ${armFee(p)}</button>
        ${err ? `<p class="tiny red">${esc(err)}</p>` : ''}
      </div>`;
  }

  /** Pagar uma rodada a um rival já vencido: respeito (amizade para as duplas). */
  private drinkCard(p: PlayerState): string {
    const rivals = p.defeatedOpponents.map((id) => getOpponent(id)).filter((o): o is NonNullable<typeof o> => !!o && respectOf(p, o.id) < FRIEND_RESPECT);
    if (!rivals.length) return '';
    const done = p.career.talkDay === p.day;
    const cost = 8 + p.level * 2;
    const rows = rivals
      .slice(0, 6)
      .map((o) => `<div class="drink-row">${portrait(o.id, 'xs')}<span class="tiny"><b>${esc(o.name)}</b> <span class="dim">${respectOf(p, o.id)}/${FRIEND_RESPECT}</span></span><button class="btn sm" data-action="career-drink" data-id="${o.id}" ${done || p.coins < cost ? 'disabled' : ''}>${t('tavern.drinkBtn')} ${icon('coin', 'xs')} ${cost}</button></div>`)
      .join('');
    return `<div class="card tavern-card"><b>${t('tavern.drinkTitle')}</b><p class="tiny dim">${done ? t('tavern.drinkDone') : t('tavern.drinkDesc')}</p>${rows}</div>`;
  }

  onAction(action: string): void {
    if (action === 'eat') this.d.actions.tavern('eat');
    if (action === 'rumor') this.d.actions.tavern('rumor');
    if (action === 'arm') this.d.actions.armWrestle();
  }
}
