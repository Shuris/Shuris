import type { Match, Position } from '@/types';

import { matchCsPerMin, matchKp, mean } from './aggregate';
import { consistency } from './timeseries';

/**
 * Identidade competitiva.
 *
 * Cada traço é uma nota de 0 a 100 obtida comparando o desempenho do jogador,
 * partida a partida, com uma referência da POSIÇÃO jogada naquela partida
 * (um suporte não é penalizado por farmar menos, por exemplo).
 * 50 = na referência · 80+ = muito acima · 20− = muito abaixo.
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

interface Bench {
  kills30: number;
  deaths30: number;
  dpm: number;
  cs: number;
  vision: number;
  kp: number;
  dmgShare: number;
}

/** Referências aproximadas por posição para elos altos. */
const BENCH: Record<Position, Bench> = {
  MID: { kills30: 6.4, deaths30: 5.0, dpm: 700, cs: 7.2, vision: 0.7, kp: 0.56, dmgShare: 0.26 },
  JUNGLE: { kills30: 5.8, deaths30: 5.2, dpm: 520, cs: 5.7, vision: 1.1, kp: 0.6, dmgShare: 0.18 },
  ADC: { kills30: 6.8, deaths30: 5.2, dpm: 700, cs: 7.6, vision: 0.66, kp: 0.56, dmgShare: 0.27 },
  SUPPORT: { kills30: 1.8, deaths30: 5.6, dpm: 260, cs: 1.2, vision: 2.3, kp: 0.6, dmgShare: 0.09 },
  TOP: { kills30: 5.0, deaths30: 5.2, dpm: 600, cs: 6.9, vision: 0.65, kp: 0.5, dmgShare: 0.22 },
};

const MIN_SAMPLE = 20;
const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)));
const toScore = (ratio: number, sensitivity: number) => clamp(50 + (ratio - 1) * sensitivity);
const f1 = (v: number) => v.toFixed(1).replace('.', ',');
const p0 = (v: number) => `${Math.round(v * 100)}%`;

export function computeIdentity(matches: Match[]): Identity {
  if (matches.length < MIN_SAMPLE) return { enough: false, sample: matches.length, traits: [] };

  const per30 = (m: Match, v: number) => v / (m.durationSec / 1800);
  const dmgShare = (m: Match) => {
    const me = m.participants.find((p) => p.isPlayer);
    const team = m.participants.filter((p) => p.team === me?.team).reduce((s, p) => s + p.damage, 0);
    return team > 0 ? m.damageDealt / team : 0;
  };

  const killRatio = mean(matches.map((m) => per30(m, m.kills) / BENCH[m.position].kills30));
  const dpmRatio = mean(matches.map((m) => m.damageDealt / (m.durationSec / 60) / BENCH[m.position].dpm));
  const fbRate = matches.filter((m) => m.firstBlood).length / matches.length;
  const farmGames = matches.filter((m) => m.position !== 'SUPPORT');
  const farmRatio = farmGames.length ? mean(farmGames.map((m) => matchCsPerMin(m) / BENCH[m.position].cs)) : 1;
  const kpRatio = mean(matches.map((m) => matchKp(m) / BENCH[m.position].kp));
  const shareRatio = mean(matches.map((m) => dmgShare(m) / BENCH[m.position].dmgShare));
  const visionRatio = mean(matches.map((m) => m.visionScore / (m.durationSec / 60) / BENCH[m.position].vision));
  const deathRatio = mean(matches.map((m) => per30(m, m.deaths) / BENCH[m.position].deaths30));
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
      score: toScore(killRatio * 0.5 + dpmRatio * 0.3 + (fbRate / 0.25) * 0.2, 140),
      evidence: `${f1(avgKills)} abates por partida e primeiro abate em ${p0(fbRate)} dos jogos.`,
    },
    {
      key: 'farm',
      axis: 'Farm',
      title: 'Especialista em farm',
      score: toScore(farmRatio, 320),
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
      score: toScore(kpRatio, 260),
      evidence: `Participa de ${p0(avgKp)} dos abates da equipe.`,
    },
    {
      key: 'impact',
      axis: 'Impacto',
      title: 'Jogador de alto impacto',
      score: toScore(shareRatio * 0.65 + dpmRatio * 0.35, 200),
      evidence: `Responsável por ${p0(avgShare)} do dano da equipe, em média.`,
    },
    {
      key: 'vision',
      axis: 'Visão',
      title: 'Controlador de visão',
      score: toScore(visionRatio, 180),
      evidence: `${f1(avgVision)} de placar de visão por minuto.`,
    },
    {
      key: 'survival',
      axis: 'Sobrevivência',
      title: 'Difícil de abater',
      score: toScore(2 - deathRatio, 160),
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
