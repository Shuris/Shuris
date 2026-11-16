import { champion } from '@/data/champions';
import { chronological, groupBy, matchCsPerMin, matchKp, mean } from '@/stats/aggregate';
import { benchFor, softScore } from '@/stats/identity';
import type { Match, Position, Rank, Tier } from '@/types';

import type { Diagnosis, SkillDiagnosis, SkillId, SkillStatus } from './types';

/**
 * Diagnóstico automático.
 *
 * Para cada habilidade calcula uma métrica nas partidas e a compara com:
 *  1. uma referência da POSIÇÃO jogada em cada partida (não há limite único para todos);
 *  2. o próprio jogador — partidas recentes contra as anteriores.
 * As referências de farm e visão acompanham a liga do jogador; as notas usam uma
 * escala suave (10% abaixo da referência ≈ 40, 30% abaixo ≈ 23), sem estourar em 0.
 * Sem amostra mínima a habilidade fica como "insuficiente" e não gera recomendação.
 * As referências são heurísticas internas do LOL Insight, não dados oficiais da Riot.
 */

const MIN_MATCHES = 10;
const RECENT = 10;
const SESSION_GAP_MS = 3 * 3_600_000;

/** Participação esperada em objetivos épicos da equipe, por posição. */
const OBJECTIVE_SHARE: Record<Position, number> = { JUNGLE: 0.75, SUPPORT: 0.6, MID: 0.55, ADC: 0.55, TOP: 0.45 };
/**
 * Converter vantagem: taxa de vitória nas partidas em que o jogador farmou ao menos 10% a mais
 * que o oponente direto. O farm é usado como sinal de vantagem individual porque depende pouco
 * do resultado final (ao contrário do ouro, que cresce com a vitória). Suporte fica de fora.
 */
const CLOSING_REFERENCE = 0.6;
const AHEAD_MARGIN = 1.1;
/** Peso de cada habilidade na ordenação das prioridades. */
const IMPACT: Record<SkillId, number> = { FARM: 1, LANE: 1.1, VISION: 0.8, OBJECTIVES: 0.9, CLOSING: 1, TEAMFIGHT: 0.85, MENTAL: 1, POOL: 0.9 };

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const f1 = (v: number) => v.toFixed(1).replace('.', ',');
const f2 = (v: number) => v.toFixed(2).replace('.', ',');
const pc = (v: number) => `${Math.round(v * 100)}%`;
const wr = (list: Match[]) => (list.length ? list.filter((m) => m.win).length / list.length : 0);
const minutes = (m: Match) => m.durationSec / 60;

/** Formata o valor da métrica principal de cada habilidade. */
export function formatSkillValue(skill: SkillId, value: number): string {
  switch (skill) {
    case 'FARM':
      return `${f1(value)} CS/min`;
    case 'LANE':
      return `${f1(value)} mortes por partida`;
    case 'VISION':
      return `${f2(value)} de visão/min`;
    case 'OBJECTIVES':
      return `${pc(value)} dos objetivos da equipe`;
    case 'CLOSING':
      return `${pc(value)} de vitórias com vantagem de farm`;
    case 'TEAMFIGHT':
      return `${pc(value)} de participação em abates`;
    case 'MENTAL':
      return `${pc(value)} de vitórias após derrotas seguidas`;
    case 'POOL':
      return `${pc(value)} das partidas nos 3 principais campeões`;
  }
}

interface Measure {
  /** Valor exibido da métrica. */
  value: number;
  /** Desempenho relativo à referência (1 = na referência; maior é sempre melhor). */
  ratio: number;
  sample: number;
}

const opponentOf = (m: Match) => {
  const me = m.participants.find((p) => p.isPlayer);
  return me ? m.participants.find((p) => p.team !== me.team && p.position === m.position) : undefined;
};

/** Partidas disputadas logo após duas ou mais derrotas seguidas na mesma sessão. */
export function afterLossStreak(all: Match[]): { after: Match[]; others: Match[] } {
  const after: Match[] = [];
  const others: Match[] = [];
  let run = 0;
  const list = chronological(all);
  list.forEach((m, i) => {
    const prev = list[i - 1];
    if (prev && m.timestamp - (prev.timestamp + prev.durationSec * 1000) > SESSION_GAP_MS) run = 0;
    (run >= 2 ? after : others).push(m);
    run = m.win ? 0 : run + 1;
  });
  return { after, others };
}

/** Mede uma habilidade em um conjunto de partidas (sem exigir amostra mínima). */
export function measureSkill(skill: SkillId, matches: Match[], tier?: Tier | null): Measure | null {
  const BENCH = (p: Position) => benchFor(p, tier);
  switch (skill) {
    case 'FARM': {
      const list = matches.filter((m) => m.position !== 'SUPPORT');
      if (!list.length) return null;
      return { value: mean(list.map(matchCsPerMin)), ratio: mean(list.map((m) => matchCsPerMin(m) / BENCH(m.position).cs)), sample: list.length };
    }
    case 'LANE': {
      if (!matches.length) return null;
      const deathRatio = mean(matches.map((m) => m.deaths / (m.durationSec / 1800) / BENCH(m.position).deaths30));
      return { value: mean(matches.map((m) => m.deaths)), ratio: 2 - deathRatio, sample: matches.length };
    }
    case 'VISION': {
      if (!matches.length) return null;
      return {
        value: mean(matches.map((m) => m.visionScore / minutes(m))),
        ratio: mean(matches.map((m) => m.visionScore / minutes(m) / BENCH(m.position).vision)),
        sample: matches.length,
      };
    }
    case 'OBJECTIVES': {
      const list = matches.filter((m) => m.objectives.playerParticipations !== undefined && m.objectives.dragons + m.objectives.barons + m.objectives.heralds > 0);
      if (!list.length) return null;
      const total = list.reduce((s, m) => s + m.objectives.dragons + m.objectives.barons + m.objectives.heralds, 0);
      const mine = list.reduce((s, m) => s + Math.min(m.objectives.playerParticipations ?? 0, m.objectives.dragons + m.objectives.barons + m.objectives.heralds), 0);
      const expected = mean(list.map((m) => OBJECTIVE_SHARE[m.position]));
      return { value: mine / total, ratio: mine / total / expected, sample: list.length };
    }
    case 'CLOSING': {
      const ahead = matches.filter((m) => {
        const foe = opponentOf(m);
        return m.position !== 'SUPPORT' && foe && foe.cs > 0 && m.cs >= foe.cs * AHEAD_MARGIN;
      });
      if (!ahead.length) return null;
      const rate = wr(ahead);
      return { value: rate, ratio: rate / CLOSING_REFERENCE, sample: ahead.length };
    }
    case 'TEAMFIGHT': {
      if (!matches.length) return null;
      return { value: mean(matches.map(matchKp)), ratio: mean(matches.map((m) => matchKp(m) / BENCH(m.position).kp)), sample: matches.length };
    }
    case 'MENTAL': {
      const { after, others } = afterLossStreak(matches);
      if (!after.length || !others.length) return null;
      // 1 = rende igual após derrotas; abaixo de 1 = cai.
      return { value: wr(after), ratio: 1 + (wr(after) - wr(others)), sample: after.length };
    }
    case 'POOL': {
      if (!matches.length) return null;
      const counts = [...groupBy(matches, (m) => m.championId).values()].map((l) => l.length).sort((a, b) => b - a);
      const share = (counts[0] + (counts[1] ?? 0) + (counts[2] ?? 0)) / matches.length;
      return { value: share, ratio: share / 0.7, sample: matches.length };
    }
  }
}

const MIN_SAMPLE: Record<SkillId, number> = { FARM: 10, LANE: 10, VISION: 10, OBJECTIVES: 10, CLOSING: 8, TEAMFIGHT: 10, MENTAL: 6, POOL: 20 };
const HIGHER_IS_BETTER: Record<SkillId, boolean> = { FARM: true, LANE: false, VISION: true, OBJECTIVES: true, CLOSING: true, TEAMFIGHT: true, MENTAL: true, POOL: true };
const LABEL: Record<SkillId, string> = {
  FARM: 'CS por minuto',
  LANE: 'Mortes por partida',
  VISION: 'Placar de visão por minuto',
  OBJECTIVES: 'Participação em objetivos épicos',
  CLOSING: 'Vitórias quando farma mais que o oponente direto',
  TEAMFIGHT: 'Participação em abates',
  MENTAL: 'Vitórias após duas derrotas seguidas',
  POOL: 'Concentração nos 3 principais campeões',
};

function reference(skill: SkillId, matches: Match[], tier?: Tier | null): string {
  const BENCH = (p: Position) => benchFor(p, tier);
  const elo = tier ? 'para o seu elo' : 'média';
  const avg = (get: (p: Position) => number) => mean(matches.map((m) => get(m.position)));
  switch (skill) {
    case 'FARM':
      return `referência ${elo} nas posições jogadas: ${f1(mean(matches.filter((m) => m.position !== 'SUPPORT').map((m) => BENCH(m.position).cs)))} CS/min`;
    case 'LANE':
      return `referência: ${f1(avg((p) => BENCH(p).deaths30))} mortes a cada 30 min`;
    case 'VISION':
      return `referência ${elo}: ${f2(avg((p) => BENCH(p).vision))} por minuto`;
    case 'OBJECTIVES':
      return `esperado para as posições jogadas: ${pc(avg((p) => OBJECTIVE_SHARE[p]))}`;
    case 'CLOSING':
      return `referência: ${pc(CLOSING_REFERENCE)}`;
    case 'TEAMFIGHT':
      return `referência: ${pc(avg((p) => BENCH(p).kp))}`;
    case 'MENTAL':
      return 'referência: a sua própria taxa nas demais partidas';
    case 'POOL':
      return 'referência: 70% ou mais';
  }
}

/** Mortes antes dos 15 minutos, quando a linha do tempo das partidas está disponível. */
function earlyDeaths(matches: Match[]): { avg: number; sample: number } | null {
  const list = matches.filter((m) => m.detailsLoaded !== false && m.timeline.length > 0);
  if (list.length < 8) return null;
  return { avg: mean(list.map((m) => m.timeline.filter((e) => e.kind === 'DEATH' && e.minute < 15).length)), sample: list.length };
}

export function diagnose(all: Match[], now: number, rank?: Rank | null): Diagnosis {
  const tier = rank?.tier;
  const matches = chronological(all);
  const enough = matches.length >= MIN_MATCHES;
  const recent = matches.slice(-RECENT);
  const previous = matches.slice(0, -RECENT);
  const overallWr = wr(matches);

  const skills: SkillDiagnosis[] = (Object.keys(LABEL) as SkillId[]).map((skill) => {
    const m = enough ? measureSkill(skill, matches, tier) : null;
    const base = { skill, metricLabel: LABEL[skill], minSample: MIN_SAMPLE[skill], higherIsBetter: HIGHER_IS_BETTER[skill] };
    if (!m || m.sample < MIN_SAMPLE[skill]) {
      const have = m?.sample ?? 0;
      return {
        ...base,
        status: 'insufficient' as SkillStatus,
        severity: 0,
        practice: null,
        sample: have,
        value: null,
        display: '—',
        reference: '',
        trend: null,
        evidence: `Amostra insuficiente: ${have} de ${MIN_SAMPLE[skill]} partidas necessárias para avaliar.`,
      };
    }

    let practice = softScore(m.ratio);
    // Comparação do jogador consigo mesmo.
    const now10 = previous.length >= 8 ? measureSkill(skill, recent, tier) : null;
    const before = previous.length >= 8 ? measureSkill(skill, previous, tier) : null;
    let trend: SkillDiagnosis['trend'] = null;
    if (now10 && before && skill !== 'POOL' && skill !== 'MENTAL' && skill !== 'CLOSING') {
      const change = now10.ratio / Math.max(0.05, before.ratio) - 1;
      trend = change >= 0.07 ? 'up' : change <= -0.07 ? 'down' : 'flat';
    }

    const parts: string[] = [`${formatSkillValue(skill, m.value)} em ${m.sample} partidas (${reference(skill, matches, tier)}).`];

    if (skill === 'FARM') {
      const worst = [...groupBy(matches.filter((x) => x.position !== 'SUPPORT'), (x) => x.championId)]
        .filter(([, l]) => l.length >= 5)
        .map(([id, l]) => ({ id, ratio: mean(l.map((x) => matchCsPerMin(x) / benchFor(x.position, tier).cs)), cs: mean(l.map(matchCsPerMin)), n: l.length }))
        .sort((a, b) => a.ratio - b.ratio)[0];
      if (worst && worst.ratio < m.ratio - 0.06) parts.push(`O farm é mais baixo com ${champion(worst.id).name}: ${f1(worst.cs)} CS/min em ${worst.n} partidas.`);
    }
    if (skill === 'LANE') {
      const early = earlyDeaths(matches);
      if (early) {
        parts.push(`${f1(early.avg)} mortes antes dos 15 minutos por partida (${early.sample} partidas com linha do tempo).`);
        if (early.avg >= 2.5) practice = Math.min(practice, 38);
      }
    }
    if (skill === 'MENTAL') {
      const { others } = afterLossStreak(matches);
      parts.push(`Nas demais partidas a taxa é ${pc(wr(others))}.`);
    }
    if (skill === 'POOL') {
      const drag = [...groupBy(matches, (x) => x.championId)]
        .filter(([, l]) => l.length >= 6)
        .map(([id, l]) => ({ id, rate: wr(l), n: l.length }))
        .sort((a, b) => a.rate - b.rate)[0];
      const distinct = new Set(matches.map((x) => x.championId)).size;
      parts.push(`${distinct} campeões diferentes no período.`);
      if (drag && drag.rate <= overallWr - 0.15) {
        parts.push(`${champion(drag.id).name} puxa a média para baixo: ${pc(drag.rate)} em ${drag.n} partidas, contra ${pc(overallWr)} no geral.`);
        practice = Math.min(practice, 40);
      }
    }
    if (trend === 'down') parts.push('Caiu nas últimas 10 partidas em relação às anteriores.');
    if (trend === 'up') parts.push('Melhorou nas últimas 10 partidas em relação às anteriores.');

    const declining = trend === 'down' && practice < 55;
    // 40 ≈ 10% abaixo da referência; 60 ≈ 10% acima.
    const status: SkillStatus = practice <= 40 || declining ? 'weakness' : practice >= 60 ? 'strength' : 'ok';
    const severity = status === 'weakness' ? clamp(Math.round((55 - practice) * 2.2 + (trend === 'down' ? 12 : 0)), 5, 100) : 0;

    return {
      ...base,
      status,
      severity,
      practice,
      sample: m.sample,
      value: m.value,
      display: formatSkillValue(skill, m.value),
      reference: reference(skill, matches, tier),
      trend,
      evidence: parts.join(' '),
    };
  });

  const weaknesses = skills
    .filter((s) => s.status === 'weakness')
    .sort((a, b) => b.severity * IMPACT[b.skill] - a.severity * IMPACT[a.skill])
    .map((s) => s.skill);

  return {
    at: now,
    sample: matches.length,
    enough,
    skills,
    weaknesses,
    note: enough ? undefined : `São necessárias ao menos ${MIN_MATCHES} partidas para um diagnóstico (há ${matches.length}).`,
  };
}
