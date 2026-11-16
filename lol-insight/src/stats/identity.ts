import type { Match, Position, Rank, Tier } from '@/types';

import { matchCsPerMin, matchKp, mean } from './aggregate';
import { consistency } from './timeseries';

/**
 * Identidade competitiva.
 *
 * Cada traço é uma nota de 0 a 100 obtida comparando o desempenho do jogador,
 * partida a partida, com uma referência da POSIÇÃO jogada naquela partida
 * (um suporte não é penalizado por farmar menos, por exemplo).
 * 50 = na referência do elo do jogador · 75+ = muito acima · 25− = muito abaixo.
 */

export type TraitKey = 'aggression' | 'farm' | 'consistency' | 'teamfight' | 'impact' | 'vision' | 'survival';

export interface Trait {
  key: TraitKey;
  /** Nome curto do eixo. */
  axis: string;
  /** Classificação concedida quando o traço é dominante. */
  title: string;
  score: number;
  /** Explicação com os números que originaram a nota. */
  evidence: string;
}

export interface Identity {
  enough: boolean;
  sample: number;
  traits: Trait[];
  primary?: Trait;
  secondary?: Trait;
}

export interface Bench {
  kills30: number;
  deaths30: number;
  dpm: number;
  cs: number;
  vision: number;
  kp: number;
  dmgShare: number;
}

/**
 * Referências aproximadas por posição, no nível de Mestre. Farm e visão crescem
 * bastante com o elo, então são ajustados pela liga do jogador (ver `benchFor`).
 * São estimativas do LOL Insight, não números oficiais da Riot.
 */
export const BENCH: Record<Position, Bench> = {
  MID: { kills30: 6.4, deaths30: 5.0, dpm: 700, cs: 7.2, vision: 0.85, kp: 0.56, dmgShare: 0.26 },
  JUNGLE: { kills30: 5.8, deaths30: 5.2, dpm: 520, cs: 5.7, vision: 1.2, kp: 0.6, dmgShare: 0.18 },
  ADC: { kills30: 6.8, deaths30: 5.2, dpm: 700, cs: 7.6, vision: 0.85, kp: 0.56, dmgShare: 0.27 },
  SUPPORT: { kills30: 1.8, deaths30: 5.6, dpm: 260, cs: 1.2, vision: 2.6, kp: 0.6, dmgShare: 0.09 },
  TOP: { kills30: 5.0, deaths30: 5.2, dpm: 600, cs: 6.9, vision: 0.8, kp: 0.5, dmgShare: 0.22 },
};

/** Quanto do farm e da visão de referência se espera em cada liga. */
const TIER_FACTOR: Record<Tier, { cs: number; vision: number }> = {
  FERRO: { cs: 0.72, vision: 0.75 },
  BRONZE: { cs: 0.76, vision: 0.8 },
  PRATA: { cs: 0.8, vision: 0.84 },
  OURO: { cs: 0.84, vision: 0.88 },
  PLATINA: { cs: 0.88, vision: 0.92 },
  ESMERALDA: { cs: 0.92, vision: 0.95 },
  DIAMANTE: { cs: 0.96, vision: 0.98 },
  MESTRE: { cs: 1, vision: 1 },
  GRAO_MESTRE: { cs: 1, vision: 1 },
  DESAFIANTE: { cs: 1, vision: 1 },
};
/** Sem elo conhecido, usa o meio da escala (Ouro). */
const DEFAULT_TIER: Tier = 'OURO';

/** Referência da posição ajustada à liga do jogador. */
export function benchFor(position: Position, tier?: Tier | null): Bench {
  const f = TIER_FACTOR[tier ?? DEFAULT_TIER];
  const b = BENCH[position];
  return { ...b, cs: b.cs * f.cs, vision: b.vision * f.vision };
}

/**
 * Converte "quanto acima ou abaixo da referência" em nota de 0 a 100.
 * 1,0 (na referência) = 50; 10% abaixo ≈ 40; 30% abaixo ≈ 23; 30% acima ≈ 77.
 * A curva achata nos extremos, então a nota nunca "estoura" em 0 ou 100 por
 * causa de uma diferença moderada.
 */
export function softScore(ratio: number): number {
  return Math.round(50 + 50 * Math.tanh(2 * (ratio - 1)));
}

const MIN_SAMPLE = 20;
const f1 = (v: number) => v.toFixed(1).replace('.', ',');
const p0 = (v: number) => `${Math.round(v * 100)}%`;

export function computeIdentity(matches: Match[], rank?: Rank | null): Identity {
  if (matches.length < MIN_SAMPLE) return { enough: false, sample: matches.length, traits: [] };

  const bench = (m: Match) => benchFor(m.position, rank?.tier);
  const per30 = (m: Match, v: number) => v / (m.durationSec / 1800);
  const dmgShare = (m: Match) => {
    const me = m.participants.find((p) => p.isPlayer);
    const team = m.participants.filter((p) => p.team === me?.team).reduce((s, p) => s + p.damage, 0);
    return team > 0 ? m.damageDealt / team : 0;
  };

  const killRatio = mean(matches.map((m) => per30(m, m.kills) / bench(m).kills30));
  const dpmRatio = mean(matches.map((m) => m.damageDealt / (m.durationSec / 60) / bench(m).dpm));
  const fbRate = matches.filter((m) => m.firstBlood).length / matches.length;
  const farmGames = matches.filter((m) => m.position !== 'SUPPORT');
  const farmRatio = farmGames.length ? mean(farmGames.map((m) => matchCsPerMin(m) / bench(m).cs)) : 1;
  const kpRatio = mean(matches.map((m) => matchKp(m) / bench(m).kp));
  const shareRatio = mean(matches.map((m) => dmgShare(m) / bench(m).dmgShare));
  const visionRatio = mean(matches.map((m) => m.visionScore / (m.durationSec / 60) / bench(m).vision));
  const deathRatio = mean(matches.map((m) => per30(m, m.deaths) / bench(m).deaths30));
  const cons = consistency(matches);

  const avgKills = mean(matches.map((m) => m.kills));
  const avgDeaths = mean(matches.map((m) => m.deaths));
  const avgKp = mean(matches.map(matchKp));
  const avgShare = mean(matches.map(dmgShare));
  const avgCs = farmGames.length ? mean(farmGames.map(matchCsPerMin)) : 0;
  const avgVision = mean(matches.map((m) => m.visionScore / (m.durationSec / 60)));

  const traits: Trait[] = [
    {
      key: 'aggression',
      axis: 'Agressão',
      title: 'Jogador agressivo',
      score: softScore(killRatio * 0.5 + dpmRatio * 0.3 + (fbRate / 0.25) * 0.2),
      evidence: `${f1(avgKills)} abates por partida e primeiro abate em ${p0(fbRate)} dos jogos.`,
    },
    {
      key: 'farm',
      axis: 'Farm',
      title: 'Especialista em farm',
      score: softScore(farmRatio),
      evidence: `${f1(avgCs)} CS/min fora do suporte — ${p0(Math.abs(farmRatio - 1))} ${farmRatio >= 1 ? 'acima' : 'abaixo'} da referência da posição.`,
    },
    {
      key: 'consistency',
      axis: 'Consistência',
      title: 'Jogador consistente',
      score: cons.score,
      evidence: `KDA mediano ${f1(cons.median)} com desvio-padrão ${f1(cons.stdDev)} entre partidas.`,
    },
    {
      key: 'teamfight',
      axis: 'Team fight',
      title: 'Especialista em team fights',
      score: softScore(kpRatio),
      evidence: `Participa de ${p0(avgKp)} dos abates da equipe.`,
    },
    {
      key: 'impact',
      axis: 'Impacto',
      title: 'Jogador de alto impacto',
      score: softScore(shareRatio * 0.65 + dpmRatio * 0.35),
      evidence: `Responsável por ${p0(avgShare)} do dano da equipe, em média.`,
    },
    {
      key: 'vision',
      axis: 'Visão',
      title: 'Controlador de visão',
      score: softScore(visionRatio),
      evidence: `${f1(avgVision)} de placar de visão por minuto.`,
    },
    {
      key: 'survival',
      axis: 'Sobrevivência',
      title: 'Difícil de abater',
      score: softScore(2 - deathRatio),
      evidence: `${f1(avgDeaths)} mortes por partida.`,
    },
  ];

  const ranked = [...traits].sort((a, b) => b.score - a.score);
  return {
    enough: true,
    sample: matches.length,
    traits,
    primary: ranked[0],
    secondary: ranked[1].score >= 55 ? ranked[1] : undefined,
  };
}
