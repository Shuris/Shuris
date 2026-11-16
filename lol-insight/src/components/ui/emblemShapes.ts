import type { Tier } from '@/types';

/**
 * Geometria dos emblemas de elo (viewBox 0 0 100 100).
 *
 * Desenho próprio do LOL Insight, inspirado na estrutura dos emblemas oficiais
 * de ranqueada: brasão metálico com uma gema no centro e "asas" que crescem a
 * cada liga, coroa nas ligas de topo. Não reproduz a arte da Riot.
 * É uma função pura para ser usada tanto pelo componente (react-native-svg)
 * quanto pela exportação do cartão de compartilhamento.
 */

export interface TierPalette {
  /** Metal claro (topo do brasão). */
  light: string;
  /** Metal escuro (base e sombras). */
  dark: string;
  /** Cor da gema central. */
  gem: string;
  /** Brilho da gema. */
  glow: string;
}

export const TIER_PALETTE: Record<Tier, TierPalette> = {
  FERRO: { light: '#A39B95', dark: '#3B3532', gem: '#77706B', glow: '#C9C1BA' },
  BRONZE: { light: '#E0A475', dark: '#5A3421', gem: '#B8683D', glow: '#F5C9A2' },
  PRATA: { light: '#E6EDF3', dark: '#5B6672', gem: '#A3B8CA', glow: '#FFFFFF' },
  OURO: { light: '#FBE3A0', dark: '#8A5A1C', gem: '#EDB443', glow: '#FFF3C8' },
  PLATINA: { light: '#BFF2EA', dark: '#245E5E', gem: '#3FC0B0', glow: '#E2FFFA' },
  ESMERALDA: { light: '#A6F0BF', dark: '#164F31', gem: '#1FB566', glow: '#D9FFE6' },
  DIAMANTE: { light: '#D3DCFF', dark: '#30357F', gem: '#6F7CFF', glow: '#EEF1FF' },
  MESTRE: { light: '#EDCBFF', dark: '#4E2179', gem: '#B35EFF', glow: '#F7E8FF' },
  GRAO_MESTRE: { light: '#FFB5A6', dark: '#6E1717', gem: '#E5403A', glow: '#FFE0D9' },
  DESAFIANTE: { light: '#FFF0BF', dark: '#24508F', gem: '#62D2FF', glow: '#E6FAFF' },
};

interface TierShape {
  wings: number;
  wingScale: number;
  spike: boolean;
  crown: boolean;
  horns: boolean;
  halo: boolean;
  /** Pingente abaixo do brasão (Platina em diante). */
  tail: boolean;
}

const SHAPE: Record<Tier, TierShape> = {
  FERRO: { wings: 0, wingScale: 0, spike: false, crown: false, horns: false, halo: false, tail: false },
  BRONZE: { wings: 1, wingScale: 0.6, spike: false, crown: false, horns: false, halo: false, tail: false },
  PRATA: { wings: 1, wingScale: 0.8, spike: false, crown: false, horns: false, halo: false, tail: false },
  OURO: { wings: 2, wingScale: 0.82, spike: true, crown: false, horns: false, halo: false, tail: false },
  PLATINA: { wings: 2, wingScale: 0.92, spike: true, crown: false, horns: false, halo: false, tail: true },
  ESMERALDA: { wings: 2, wingScale: 1, spike: true, crown: false, horns: false, halo: false, tail: true },
  DIAMANTE: { wings: 3, wingScale: 0.95, spike: true, crown: false, horns: false, halo: false, tail: true },
  MESTRE: { wings: 3, wingScale: 1, spike: false, crown: true, horns: false, halo: false, tail: true },
  GRAO_MESTRE: { wings: 3, wingScale: 1, spike: false, crown: false, horns: true, halo: false, tail: true },
  DESAFIANTE: { wings: 3, wingScale: 1.05, spike: false, crown: true, horns: false, halo: true, tail: true },
};

/** Preenchimento lógico; o componente troca pelos gradientes/cores reais. */
export type EmblemFill = 'metal' | 'metalDeep' | 'edge' | 'gem' | 'facet' | 'shine' | 'halo';

export interface EmblemPart {
  d: string;
  fill: EmblemFill;
  /** Desenhar também espelhado no eixo vertical (x = 50). */
  mirror?: boolean;
  opacity?: number;
  /** Quando definido, a peça é um contorno (sem preenchimento). */
  stroke?: number;
}

const f = (n: number) => Math.round(n * 10) / 10;

/** Gira e escala um ponto em torno de um pivô. */
function tf(x: number, y: number, px: number, py: number, deg: number, s: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  const dx = (x - px) * s;
  const dy = (y - py) * s;
  return [f(px + dx * Math.cos(r) - dy * Math.sin(r)), f(py + dx * Math.sin(r) + dy * Math.cos(r))];
}

/** Lâmina de asa do lado direito, a partir da borda do brasão. */
function wing(deg: number, s: number): string {
  const P: [number, number] = [70, 44];
  const a = tf(70, 34, ...P, deg, s);
  const c1 = tf(84, 28, ...P, deg, s);
  const tip = tf(97, 14, ...P, deg, s);
  const c2 = tf(92, 38, ...P, deg, s);
  const b = tf(71, 54, ...P, deg, s);
  return `M${a} Q${c1} ${tip} Q${c2} ${b} Z`.replace(/,/g, ' ');
}

const CREST = 'M50 17 L73 29 L73 58 Q73 74 50 87 Q27 74 27 58 L27 29 Z';
const CREST_INNER = 'M50 25 L66 34 L66 57 Q66 68 50 78 Q34 68 34 57 L34 34 Z';
const GEM = 'M50 33 L61 52 L50 71 L39 52 Z';
const GEM_FACET = 'M50 33 L61 52 L50 57 L39 52 Z';
const GEM_SHINE = 'M50 36 L53 51 L50 55 L47 51 Z';

export function emblemParts(tier: Tier): EmblemPart[] {
  const s = SHAPE[tier];
  const parts: EmblemPart[] = [];
  if (s.halo) {
    parts.push({ d: 'M50 6 A44 44 0 1 1 49.9 6 Z', fill: 'halo', opacity: 0.1 });
    parts.push({ d: 'M50 6 A44 44 0 1 1 49.9 6 Z', fill: 'metal', stroke: 2.2, opacity: 0.9 });
  }
  // Asas de trás para frente: a mais baixa primeiro.
  const angles = [0, 26, 52].slice(0, s.wings).reverse();
  angles.forEach((deg, i) => {
    const scale = s.wingScale * (1 - (s.wings - 1 - i) * 0.12);
    parts.push({ d: wing(deg, scale), fill: i === angles.length - 1 ? 'metal' : 'metalDeep', mirror: true });
  });
  if (s.horns) parts.push({ d: 'M38 25 Q20 18 22 0 Q30 15 44 21 Z', fill: 'metal', mirror: true });
  if (s.crown) {
    parts.push({ d: 'M50 1 L56 17 L44 17 Z', fill: 'metal' });
    parts.push({ d: 'M37 7 L45 19 L35 22 Z', fill: 'metalDeep', mirror: true });
  } else if (s.spike) {
    parts.push({ d: 'M50 5 L55 18 L45 18 Z', fill: 'metal' });
  }
  if (s.tail) parts.push({ d: 'M50 80 L56 90 L50 99 L44 90 Z', fill: 'metalDeep' });
  parts.push({ d: CREST, fill: 'metal' });
  parts.push({ d: CREST, fill: 'shine', stroke: 1.2, opacity: 0.35 });
  parts.push({ d: CREST_INNER, fill: 'edge' });
  parts.push({ d: CREST_INNER, fill: 'metalDeep', stroke: 1.4, opacity: 0.9 });
  parts.push({ d: GEM, fill: 'gem' });
  parts.push({ d: GEM_FACET, fill: 'facet', opacity: 0.55 });
  parts.push({ d: GEM_SHINE, fill: 'shine', opacity: 0.8 });
  return parts;
}
