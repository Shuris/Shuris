// Retratos em pixel art (usados na interface HTML: arena, torneio e menu).
// Os balões de fala da cena ficam só com texto.
import { OPPONENTS } from '../core/data/opponents';
import { POOL } from '../core/data/fighters';

/** Moradores com retrato próprio. */
export const NPC_PORTRAITS = ['monk', 'keeper', 'quintus', 'instructor', 'doctore', 'trainee', 'vendor', 'patron', 'merchant', 'medic', 'smith'];

export const PORTRAIT_IDS = [...OPPONENTS.map((o) => o.id), ...POOL.map((f) => f.id), ...NPC_PORTRAITS, 'locked'];

export const PLAYER_PORTRAIT_LAYERS = [
  'layer_base_0', 'layer_base_1', 'layer_base_2', 'layer_hair_0', 'layer_hair_1', 'layer_hair_2', 'layer_beard',
  ...['cap', 'galea', 'murmillo', 'provocator', 'secutor', 'crupellarius'].map((h) => `layer_helmet_${h}`),
];

export interface PlayerLook {
  skin: number;
  hairStyle: number;
  hairColor: number;
  beard: boolean;
  helmet: string | null;
}
