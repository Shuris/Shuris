import { Rng } from '@/data/prng';
import { chronological, matchCsPerMin, matchKda, mean, streaks } from '@/stats/aggregate';
import { BENCH } from '@/stats/identity';
import { absoluteLabel, absoluteToRank, rankLabel, rankToAbsolute } from '@/stats/rank';
import type { Match, Rank, RankSnapshot } from '@/types';

import { estimateLpPerGame, type LpEstimate } from './lpHistory';
import type { ConfidenceLevel, Diagnosis, GoalAnalysis, HorizonForecast, PathPoint, Prediction, Scenario, ScenarioKey } from './types';

/**
 * Rank Predictor — modelo estatístico transparente.
 *
 * 1. Taxa de vitória PONDERADA das ranqueadas Solo/Duo: partidas recentes pesam
 *    mais (peso cai pela metade a cada 20 partidas).
 * 2. SUAVIZAÇÃO: mistura com 12 partidas "neutras" a 50%, porque o pareamento
 *    puxa todos para perto de 50% e poucas partidas enganam.
 * 3. Ajuste pequeno (até ±1,5 p.p.) pela evolução de KDA, farm e dano, que são
 *    indicadores auxiliares, não garantias de vitória.
 * 4. Volume: partidas ranqueadas por semana observadas no histórico.
 * 5. LP por vitória e por derrota: medidos no histórico quando existe; senão,
 *    valor neutro e confiança reduzida.
 * 6. Simulação: milhares de sequências de partidas em 30 dias, sorteando o
 *    resultado de cada partida, o LP de cada uma e a incerteza da própria taxa.
 *    Daí saem a mediana (projeção central) e o intervalo de 10% a 90%.
 *
 * O modelo não conhece o MMR, que a Riot não divulga.
 */

const HALF_LIFE = 20;
const PRIOR_GAMES = 12;
const MIN_RANKED = 10;
const SIMULATIONS = 1200;
const HORIZONS = [7, 15, 30] as const;
const WINDOWS = [10, 20, 50, 100];
const DAY = 86_400_000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pct1 = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`;
const signedLp = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v))} LP`;

export interface PredictionInput {
  rank: Rank | null;
  matches: Match[];
  rankHistory: RankSnapshot[];
  /** Instante de referência dos dados. */
  asOf: number;
  goal?: Rank | null;
  diagnosis?: Diagnosis;
  /** Aulas recomendadas por habilidade, para ligar obstáculos à Academy. */
  lessonsFor?: (skill: Diagnosis['weaknesses'][number]) => string[];
}

interface SimConfig {
  start: number;
  p: number;
  pSe: number;
  gamesMean: number;
  lp: LpEstimate;
  seed: number;
  target?: number;
}

interface SimResult {
  /** Para cada dia (0–30), os LP absolutos de todas as simulações, ordenados. */
  byDay: number[][];
  /** Parcela das simulações que alcançou o alvo em algum momento. */
  reached: number;
}

/** Simula 30 dias de ranqueadas. Determinístico para a mesma semente. */
function simulate(cfg: SimConfig): SimResult {
  const rng = new Rng(cfg.seed);
  const byDay: number[][] = Array.from({ length: 31 }, () => new Array<number>(SIMULATIONS));
  let reached = 0;
  for (let s = 0; s < SIMULATIONS; s++) {
    const p = clamp(cfg.pSe > 0 ? rng.normal(cfg.p, cfg.pSe) : cfg.p, 0.15, 0.85);
    const games = Math.max(0, Math.round(rng.normal(cfg.gamesMean, Math.sqrt(Math.max(1, cfg.gamesMean)))));
    let lp = cfg.start;
    let hit = cfg.target !== undefined && lp >= cfg.target;
    let played = 0;
    byDay[0][s] = lp;
    for (let day = 1; day <= 30; day++) {
      const until = Math.round((games * day) / 30);
      for (; played < until; played++) {
        if (rng.chance(p)) lp += Math.max(1, rng.normal(cfg.lp.gain, cfg.lp.gainSd));
        else lp = Math.max(0, lp - Math.max(1, rng.normal(cfg.lp.loss, cfg.lp.lossSd)));
        if (cfg.target !== undefined && lp >= cfg.target) hit = true;
      }
      byDay[day][s] = lp;
    }
    if (hit) reached++;
  }
  for (const list of byDay) list.sort((a, b) => a - b);
  return { byDay, reached: reached / SIMULATIONS };
}

const quantile = (sorted: number[], q: number) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]);

/** Índice auxiliar de desempenho de uma partida (KDA, farm e dano relativos à posição). */
function performanceIndex(m: Match): number {
  const kda = Math.min(2, matchKda(m) / 3);
  const cs = m.position === 'SUPPORT' ? 1 : matchCsPerMin(m) / BENCH[m.position].cs;
  const dmg = m.damageDealt / (m.durationSec / 60) / BENCH[m.position].dpm;
  return (kda + cs + dmg) / 3;
}

function downgrade(level: ConfidenceLevel): ConfidenceLevel {
  return level === 'alta' ? 'média' : 'baixa';
}

export function predict(input: PredictionInput): { prediction: Prediction; goal: GoalAnalysis | null } {
  const empty = (status: Prediction['status'], message: string): { prediction: Prediction; goal: null } => ({
    prediction: { status, message, currentRank: input.rank, currentAbs: input.rank ? rankToAbsolute(input.rank) : null, horizons: [], path: [] },
    goal: null,
  });

  if (!input.rank) return empty('unranked', 'Esta conta não tem elo na fila Solo/Duo. A previsão começa quando houver uma classificação.');

  const ranked = chronological(input.matches).filter((m) => m.queue === 'SOLO');
  if (ranked.length < MIN_RANKED) {
    return empty(
      'insufficient',
      `São necessárias ao menos ${MIN_RANKED} partidas ranqueadas Solo/Duo para projetar o elo (há ${ranked.length}). Com menos do que isso, qualquer número seria palpite.`,
    );
  }

  // ---- Volume de partidas ----------------------------------------------------
  const last28 = ranked.filter((m) => m.timestamp > input.asOf - 28 * DAY);
  const spanDays = (input.asOf - ranked[0].timestamp) / DAY;
  let gamesPerWeek: number;
  let basis: string;
  if (spanDays >= 28) {
    gamesPerWeek = last28.length / 4;
    basis = `${last28.length} ranqueadas nos últimos 28 dias`;
  } else {
    const span = Math.max(3, spanDays);
    gamesPerWeek = (ranked.length / span) * 7;
    basis = `${ranked.length} ranqueadas em ${Math.round(span)} dias (histórico curto)`;
  }
  gamesPerWeek = Math.min(80, gamesPerWeek);
  if (gamesPerWeek < 0.5) {
    return empty('insufficient', 'Nenhuma partida ranqueada nos últimos 28 dias. Sem ritmo de jogo recente não há como projetar a evolução.');
  }

  // ---- Taxa de vitória ---------------------------------------------------------
  const n = ranked.length;
  let sw = 0;
  let sww = 0;
  let wins = 0;
  ranked.forEach((m, i) => {
    const w = 0.5 ** ((n - 1 - i) / HALF_LIFE);
    sw += w;
    sww += w * w;
    if (m.win) wins += w;
  });
  const weighted = wins / sw;
  const effective = (sw * sw) / sww;
  const smoothed = (wins + 0.5 * PRIOR_GAMES) / (sw + PRIOR_GAMES);
  const se = Math.sqrt((smoothed * (1 - smoothed)) / (effective + PRIOR_GAMES));

  // Indicadores auxiliares: evolução de KDA, farm e dano.
  let adjustment = 0;
  let trendText = 'KDA, farm e dano estáveis: nenhum ajuste aplicado.';
  if (n >= 18) {
    const recent = mean(ranked.slice(-10).map(performanceIndex));
    const before = mean(ranked.slice(-30, -10).map(performanceIndex));
    const rel = before > 0 ? recent / before - 1 : 0;
    if (Math.abs(rel) >= 0.08) {
      adjustment = clamp(rel * 0.1, -0.015, 0.015);
      trendText = `KDA, farm e dano ${rel > 0 ? 'subiram' : 'caíram'} ${Math.abs(Math.round(rel * 100))}% nas últimas 10 partidas: ajuste de ${adjustment > 0 ? '+' : '−'}${Math.abs(adjustment * 100)
        .toFixed(1)
        .replace('.', ',')} p.p. (indicadores auxiliares, com peso pequeno).`;
    }
  } else {
    trendText = 'Partidas insuficientes para medir a evolução de KDA, farm e dano.';
  }
  const p = clamp(smoothed + adjustment, 0.25, 0.75);

  const lp = estimateLpPerGame(input.matches, input.rankHistory);
  const start = rankToAbsolute(input.rank);
  const st = streaks(ranked);
  const seedBase = (start * 31 + n * 7 + Math.round(weighted * 1000)) >>> 0;
  const games30 = (gamesPerWeek * 30) / 7;
  const delta = clamp(se, 0.025, 0.06);
  const targetAbs = input.goal ? rankToAbsolute(input.goal) : undefined;

  // ---- Confiança -------------------------------------------------------------
  let score = 100;
  const reasons: string[] = [];
  if (n < 20) (score -= 30), reasons.push(`Apenas ${n} ranqueadas analisadas: a taxa de vitória ainda oscila muito.`);
  else if (n < 35) (score -= 15), reasons.push(`${n} ranqueadas analisadas: amostra razoável, mas ainda limitada.`);
  else reasons.push(`${n} ranqueadas analisadas: boa amostra.`);
  if (lp.source === 'default') (score -= 15), reasons.push('LP por partida ainda não medido: usando valor neutro.');
  else reasons.push('LP por vitória e derrota medidos no histórico.');
  if (spanDays < 14) (score -= 10), reasons.push('Histórico de menos de duas semanas: o ritmo de partidas pode não ser o habitual.');
  if (Math.abs(st.current) >= 4) (score -= 5), reasons.push(`Sequência atual de ${Math.abs(st.current)} ${st.current > 0 ? 'vitórias' : 'derrotas'}: resultados recentes podem não se repetir.`);
  if (start >= rankToAbsolute({ tier: 'MESTRE', division: 1, lp: 0 }) - 100) (score -= 10), reasons.push('Perto ou acima de Mestre o ganho de LP por partida muda bastante.');
  if (se >= 0.055) (score -= 10), reasons.push(`A taxa de vitória recente tem margem de ±${Math.round(se * 100)} p.p.`);

  // ---- Simulações ------------------------------------------------------------
  const runs: Record<ScenarioKey, { p: number; games: number; sim: SimResult; label: string }> = {
    conservative: { p: p - delta, games: games30 * 0.85, label: 'Conservador', sim: null as never },
    realistic: { p, games: games30, label: 'Realista', sim: null as never },
    optimistic: { p: p + delta, games: games30 * 1.1, label: 'Otimista', sim: null as never },
  };
  runs.conservative.sim = simulate({ start, p: runs.conservative.p, pSe: 0, gamesMean: runs.conservative.games, lp, seed: seedBase + 1 });
  runs.realistic.sim = simulate({ start, p: runs.realistic.p, pSe: se, gamesMean: runs.realistic.games, lp, seed: seedBase + 2, target: targetAbs });
  runs.optimistic.sim = simulate({ start, p: runs.optimistic.p, pSe: 0, gamesMean: runs.optimistic.games, lp, seed: seedBase + 3 });

  const common = [
    `Taxa de vitória ponderada das últimas ${n} ranqueadas: ${pct1(weighted)} (as partidas recentes pesam mais).`,
    `Suavizada com ${PRIOR_GAMES} partidas neutras a 50%, para não exagerar amostras pequenas: ${pct1(smoothed)}.${adjustment ? ` Com o ajuste dos indicadores auxiliares: ${pct1(p)}.` : ''}`,
  ];

  const horizons: HorizonForecast[] = HORIZONS.map((days) => {
    const scenarios: Scenario[] = (Object.keys(runs) as ScenarioKey[]).map((key) => {
      const r = runs[key];
      const g = Math.round((r.games * days) / 30);
      const projected = quantile(r.sim.byDay[days], 0.5);
      const expected = g * (r.p * lp.gain - (1 - r.p) * lp.loss);
      const how =
        key === 'realistic'
          ? `Cenário realista: mantém ${pct1(r.p)} e o volume habitual de ${Math.round(gamesPerWeek)} partidas por semana.`
          : key === 'conservative'
            ? `Cenário conservador: ${pct1(p)} − ${(delta * 100).toFixed(1).replace('.', ',')} p.p. = ${pct1(r.p)}, com 85% do volume habitual.`
            : `Cenário otimista: ${pct1(p)} + ${(delta * 100).toFixed(1).replace('.', ',')} p.p. = ${pct1(r.p)}, com 10% mais partidas.`;
      return {
        key,
        label: r.label,
        winRate: r.p,
        games: g,
        currentAbs: start,
        projectedAbs: projected,
        lpChange: projected - start,
        confidence: 'média',
        explanation: [
          ...common,
          how,
          `Cerca de ${g} partidas em ${days} dias × (${pct1(r.p)} × +${Math.round(lp.gain)} LP − ${pct1(1 - r.p)} × ${Math.round(lp.loss)} LP) ≈ ${signedLp(expected)} esperados.`,
          `Mediana de 1.200 simulações: ${absoluteLabel(projected)}.`,
        ],
      };
    });
    return {
      days,
      expectedGames: Math.round((games30 * days) / 30),
      central: quantile(runs.realistic.sim.byDay[days], 0.5),
      low: quantile(runs.realistic.sim.byDay[days], 0.1),
      high: quantile(runs.realistic.sim.byDay[days], 0.9),
      scenarios,
    };
  });

  // Um intervalo de 30 dias mais largo que uma liga inteira não comporta confiança alta.
  const width30 = horizons[2].high - horizons[2].low;
  if (width30 > 400) (score = Math.min(score, 69)), reasons.push('O intervalo de 30 dias cobre mais de uma liga: muitos resultados diferentes são plausíveis.');
  const level: ConfidenceLevel = score >= 70 ? 'alta' : score >= 45 ? 'média' : 'baixa';
  for (const h of horizons) for (const sc of h.scenarios) sc.confidence = sc.key === 'realistic' ? level : downgrade(level);

  const path: PathPoint[] = [];
  for (let day = 0; day <= 30; day += 3) {
    path.push({
      day,
      p10: quantile(runs.realistic.sim.byDay[day], 0.1),
      p50: quantile(runs.realistic.sim.byDay[day], 0.5),
      p90: quantile(runs.realistic.sim.byDay[day], 0.9),
      conservative: quantile(runs.conservative.sim.byDay[day], 0.5),
      optimistic: quantile(runs.optimistic.sim.byDay[day], 0.5),
    });
  }

  const h30 = horizons[2];
  const label = (abs: number) => rankLabel(absoluteToRank(abs));
  const optimistic30 = h30.scenarios[2];
  const centralLabel = label(h30.central);
  const optimisticLabel = label(optimistic30.projectedAbs);
  const headline =
    `Seu elo atual é ${rankLabel(input.rank)} (${input.rank.lp} LP). Mantendo o desempenho recente e jogando cerca de ${Math.round(gamesPerWeek)} ranqueadas por semana, ` +
    `a projeção central para 30 dias é ${absoluteLabel(h30.central)}, com intervalo provável de ${absoluteLabel(h30.low)} a ${absoluteLabel(h30.high)}.` +
    (optimisticLabel !== centralLabel ? ` ${optimisticLabel} aparece no cenário otimista, caso a sua taxa de vitória suba para ${pct1(optimistic30.winRate)}.` : '');

  const prediction: Prediction = {
    status: 'ok',
    currentRank: input.rank,
    currentAbs: start,
    inputs: {
      rankedGames: n,
      winRates: WINDOWS.map((window) => {
        const slice = ranked.slice(-window);
        return { window, games: slice.length, winRate: n >= window ? slice.filter((m) => m.win).length / slice.length : null };
      }),
      weightedWinRate: weighted,
      smoothedWinRate: p,
      stdError: se,
      effectiveSample: effective,
      gamesPerWeek,
      gamesPerWeekBasis: basis,
      lpGain: lp.gain,
      lpLoss: lp.loss,
      lpSource: lp.source,
      lpSourceText: lp.text,
      trendAdjustment: adjustment,
      trendText,
      currentStreak: st.current,
    },
    horizons,
    path,
    confidence: { level, score: Math.max(0, score), reasons },
    headline,
  };

  // ---- Meta de elo ---------------------------------------------------------------
  let goal: GoalAnalysis | null = null;
  if (input.goal && targetAbs !== undefined) {
    const distance = Math.max(0, targetAbs - start);
    const reached = distance === 0;
    const perGame = p * lp.gain - (1 - p) * lp.loss;
    const gamesNeeded = reached ? 0 : perGame > 0.3 ? Math.ceil(distance / perGame) : null;
    const required = (games: number) => (distance / games + lp.loss) / (lp.gain + lp.loss);
    const g30 = Math.max(1, Math.round(games30));
    const options = [
      { games: g30, label: `em 30 dias (≈ ${g30} partidas, seu ritmo atual)` },
      { games: 50, label: 'em 50 partidas' },
      { games: 100, label: 'em 100 partidas' },
    ].filter((o, i, list) => list.findIndex((x) => x.games === o.games) === i);
    const obstacles = (input.diagnosis?.weaknesses ?? []).slice(0, 3).map((skill) => ({
      skill,
      text: input.diagnosis!.skills.find((s) => s.skill === skill)!.evidence,
      lessonIds: input.lessonsFor?.(skill) ?? [],
    }));

    const summary: string[] = [];
    if (reached) summary.push(`Você já está em ${rankLabel(input.rank)}, igual ou acima da meta.`);
    else {
      summary.push(`Faltam ${distance} LP até ${rankLabel(input.goal)}.`);
      summary.push(
        gamesNeeded === null
          ? `Com a taxa atual (${pct1(p)}) e o LP estimado por partida, a tendência é ficar parado ou cair: a meta exige melhorar a taxa de vitória.`
          : `No ritmo atual (${pct1(p)} de vitórias, ${signedLp(perGame)} por partida em média) são cerca de ${gamesNeeded} partidas — aproximadamente ${Math.max(1, Math.round(gamesNeeded / gamesPerWeek))} semanas.`,
      );
      summary.push(`Em ${Math.round(runs.realistic.sim.reached * 100)}% das simulações a meta é alcançada em até 30 dias.`);
    }

    goal = {
      target: input.goal,
      targetAbs,
      distance,
      reached,
      lpPerGame: perGame,
      gamesNeeded,
      weeksNeeded: gamesNeeded === null ? null : gamesNeeded / gamesPerWeek,
      currentWinRate: p,
      requiredWinRates: reached ? [] : options.map((o) => ({ ...o, winRate: required(o.games), feasible: required(o.games) <= 0.65 })),
      probability30: reached ? 1 : runs.realistic.sim.reached,
      obstacles,
      summary,
    };
  }

  return { prediction, goal };
}
