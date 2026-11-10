// Taverna do Javali: comida, vinho com boatos sobre o próximo rival e conversa.
import type { PlayerState } from '../../core/model/types';
import { MEAL_ENERGY, MEAL_MINUTES, RUMOR_COST, RUMOR_MINUTES, canEat, canHearRumor, canTalk, mealCost } from '../../core/systems/TavernSystem';
import { nextRival } from '../../core/systems/NewsSystem';
import { esc, icon } from '../dom';
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
    const talkErr = canTalk(p);
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
      ${card('talk', t('tavern.chat'), t('tavern.chatDesc'), t('tavern.talk'), talkErr)}`;
  }

  onAction(action: string): void {
    if (action === 'eat') this.d.actions.tavern('eat');
    if (action === 'rumor') this.d.actions.tavern('rumor');
    if (action === 'talk') this.d.actions.tavern('talk');
  }
}
