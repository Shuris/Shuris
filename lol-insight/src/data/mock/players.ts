import type { PlayerBundle } from '@/types';

import { generateBundle, type PlayerProfile } from './generator';

/** Instante de referência fixo dos dados demonstrativos (15/11/2026, 23h59). */
export const MOCK_AS_OF = new Date(2026, 10, 15, 23, 59).getTime();

const PROFILES: PlayerProfile[] = [
  {
    seed: 20265,
    asOf: MOCK_AS_OF,
    days: 90,
    baseWinRate: 0.475,
    player: {
      id: 'gregory-br1',
      gameName: 'Gregory',
      tagLine: 'BR1',
      region: 'BR',
      level: 287,
      profileIconId: 29,
      rank: { tier: 'DIAMANTE', division: 3, lp: 64 },
      seasonHistory: [
        { season: '2023', rank: { tier: 'PLATINA', division: 2, lp: 41 } },
        { season: '2024', rank: { tier: 'ESMERALDA', division: 2, lp: 73 } },
        { season: '2025', rank: { tier: 'ESMERALDA', division: 1, lp: 18 } },
      ],
    },
    pool: [
      { championId: 'Zoe', position: 'MID', weight: 25, skill: 0.1 },
      { championId: 'Ahri', position: 'MID', weight: 16, skill: 0.03 },
      { championId: 'Syndra', position: 'MID', weight: 12, skill: 0.03 },
      { championId: 'Orianna', position: 'MID', weight: 10, skill: 0.05 },
      { championId: 'Leblanc', position: 'MID', weight: 7, skill: -0.06 },
      { championId: 'LeeSin', position: 'JUNGLE', weight: 9, skill: -0.05 },
      { championId: 'Vi', position: 'JUNGLE', weight: 5, skill: -0.02 },
      { championId: 'Jinx', position: 'ADC', weight: 7, skill: -0.05 },
      { championId: 'Thresh', position: 'SUPPORT', weight: 6, skill: 0 },
      { championId: 'Jax', position: 'TOP', weight: 5, skill: -0.08 },
    ],
    // Rende mais à noite; cai de produção de madrugada e no início da tarde.
    hourEffect: (h) => (h >= 19 && h <= 23 ? 0.045 : h < 6 ? -0.1 : h < 12 ? -0.02 : -0.05),
    sessionHours: [
      { w: 58, v: [19, 22] },
      { w: 22, v: [13, 17] },
      { w: 10, v: [9, 11] },
      { w: 10, v: [0, 2] },
    ],
  },
  {
    seed: 77102,
    asOf: MOCK_AS_OF,
    days: 90,
    baseWinRate: 0.46,
    player: {
      id: 'yuna-kr1',
      gameName: 'Yuna',
      tagLine: 'KR1',
      region: 'KR',
      level: 412,
      profileIconId: 23,
      rank: { tier: 'ESMERALDA', division: 2, lp: 37 },
      seasonHistory: [
        { season: '2023', rank: { tier: 'OURO', division: 1, lp: 55 } },
        { season: '2024', rank: { tier: 'PLATINA', division: 1, lp: 12 } },
        { season: '2025', rank: { tier: 'ESMERALDA', division: 1, lp: 80 } },
      ],
    },
    pool: [
      { championId: 'Jinx', position: 'ADC', weight: 24, skill: 0.06 },
      { championId: 'Kaisa', position: 'ADC', weight: 20, skill: 0.04 },
      { championId: 'Ezreal', position: 'ADC', weight: 14, skill: -0.04 },
      { championId: 'Lulu', position: 'SUPPORT', weight: 10, skill: 0.02 },
      { championId: 'Thresh', position: 'SUPPORT', weight: 7, skill: -0.05 },
      { championId: 'Ahri', position: 'MID', weight: 8, skill: -0.03 },
      { championId: 'Orianna', position: 'MID', weight: 5, skill: -0.06 },
      { championId: 'Vi', position: 'JUNGLE', weight: 5, skill: -0.08 },
    ],
    hourEffect: (h) => (h >= 13 && h <= 18 ? 0.04 : h >= 22 || h < 6 ? -0.08 : 0),
    sessionHours: [
      { w: 45, v: [13, 17] },
      { w: 35, v: [19, 22] },
      { w: 20, v: [9, 11] },
    ],
  },
];

let cache: PlayerBundle[] | null = null;

/** Gera (uma única vez) e devolve as contas demonstrativas. */
export function mockBundles(): PlayerBundle[] {
  if (!cache) cache = PROFILES.map((p) => withDemoMastery(generateBundle(p)));
  return cache;
}

/** Pontos aproximados para cada nível de maestria (estimativa usada só na demonstração). */
const MASTERY_STEPS = [0, 1800, 6000, 12600, 21600, 32400, 43200, 54000, 65000, 76000];

/**
 * Maestria fictícia da demonstração, coerente com as partidas: quem joga mais um
 * campeão tem mais pontos. Calculada depois das partidas, sem alterar o gerador.
 */
function withDemoMastery(b: PlayerBundle): PlayerBundle {
  const by = new Map<string, { games: number; last: number }>();
  for (const m of b.matches) {
    const e = by.get(m.championId) ?? { games: 0, last: 0 };
    e.games++;
    e.last = Math.max(e.last, m.timestamp);
    by.set(m.championId, e);
  }
  const mastery = [...by.entries()]
    .map(([championId, e]) => {
      // Histórico anterior aos 90 dias: proporcional ao uso atual, determinístico pelo nome.
      const seed = [...championId].reduce((a, c) => a + c.charCodeAt(0), 0) % 7;
      const points = Math.round(e.games * 2600 + e.games * e.games * 90 + seed * 1500);
      const level = MASTERY_STEPS.filter((t) => points >= t).length;
      return { championId, level, points, lastPlayed: e.last };
    })
    .sort((x, y) => y.points - x.points);
  return { ...b, mastery };
}
