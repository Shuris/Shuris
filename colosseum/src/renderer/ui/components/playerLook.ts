// Aparência do jogador para os retratos (capacete equipado e camadas).
import type { PlayerState } from '../../core/model/types';
import { equippedItems } from '../../core/systems/AttributeSystem';

/** Tipo do capacete equipado ('galea', 'cap'...) ou null. */
export function playerHelmet(p: PlayerState): string | null {
  const head = equippedItems(p).head;
  const sheet = head?.visual.sheets.find((s) => s.startsWith('helmet_'));
  return sheet ? sheet.slice(7) : null;
}

/** Dados do retrato do jogador para a cena (camadas tingidas no Phaser). */
export interface PlayerPortraitKey {
  skin: number;
  hairStyle: number;
  hairColor: number;
  beard: boolean;
  helmet: string | null;
}

export function playerPortraitKey(p: PlayerState): PlayerPortraitKey {
  const a = p.appearance;
  return { skin: a.skin, hairStyle: a.hairStyle, hairColor: a.hairColor, beard: a.beard, helmet: playerHelmet(p) };
}
