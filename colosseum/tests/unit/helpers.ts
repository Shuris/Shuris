import type { PlayerState } from '../../src/renderer/core/model/types';
import { ATTRIBUTE_KEYS } from '../../src/renderer/core/model/types';
import { createPlayer } from '../../src/renderer/core/systems/PlayerFactory';
import { addItem } from '../../src/renderer/core/systems/EquipmentSystem';
import type { OpponentDef } from '../../src/renderer/core/data/opponents';
import { getItem } from '../../src/renderer/core/data/equipment';

export const APPEARANCE = { skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 };

/** Jogador "típico" no nível do adversário, com pontos equilibrados e o mesmo equipamento. */
export function typicalPlayer(opp: OpponentDef, strategy: PlayerState['strategy'] = 'balanced'): PlayerState {
  const p = createPlayer('Teste', 'gaul', APPEARANCE);
  p.level = opp.level;
  let points = 3 * (opp.level - 1);
  let i = 0;
  const order = ['str', 'vit', 'agi', 'res', 'prec', 'str', 'vit', 'tech'] as const;
  while (points-- > 0) p.baseAttributes[order[i++ % order.length]]++;
  const train = Math.round(opp.level * 0.5);
  for (let k = 0; k < train; k++) p.trainedBonus[ATTRIBUTE_KEYS[k % 4 === 0 ? 0 : k % 4 === 1 ? 2 : k % 4 === 2 ? 3 : 5]]++;
  p.inventory = [];
  p.equipment = { mainHand: null, offHand: null, head: null, body: null, legs: null };
  for (const [slot, id] of Object.entries(opp.equipment)) {
    if (!id || !getItem(id)) continue;
    const inv = addItem(p, id);
    p.equipment[slot as keyof PlayerState['equipment']] = inv.uid;
  }
  p.strategy = strategy;
  return p;
}
