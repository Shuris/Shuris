// Anfiteatros: um diferente a cada dois adversários.
import { opponentIndex } from './opponents';

export interface ArenaDef {
  id: string;
  name: string;
  /** chave da imagem de fundo e da camada de público */
  bg: string;
  crowd: string;
}

export const ARENAS: ArenaDef[] = [
  { id: 'capua', name: 'Arena de Cápua', bg: 'bg:arena_capua', crowd: 'bg:crowd_capua' },
  { id: 'pompeii', name: 'Anfiteatro de Pompeia', bg: 'bg:arena_pompeii', crowd: 'bg:crowd_pompeii' },
  { id: 'verona', name: 'Arena de Verona', bg: 'bg:arena_verona', crowd: 'bg:crowd_verona' },
  { id: 'leptis', name: 'Anfiteatro de Leptis Magna', bg: 'bg:arena_leptis', crowd: 'bg:crowd_leptis' },
  { id: 'rome', name: 'Coliseu de Roma', bg: 'bg:arena_rome', crowd: 'bg:crowd_rome' },
];

/** Marcus e Cassius → Cápua; Rufus e Brutus → Pompeia; e assim por diante. */
export function arenaForOpponent(opponentId: string): ArenaDef {
  const idx = Math.max(0, opponentIndex(opponentId));
  return ARENAS[Math.min(ARENAS.length - 1, Math.floor(idx / 2))];
}

