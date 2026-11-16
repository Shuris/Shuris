import { champion } from '@/data/champions';
import type { MapPoint, Match, MatchAnalysis, Tier } from '@/types';

import { matchCsPerMin, matchKp } from './aggregate';
import { dec, int, pct, signed } from './format';
import { benchFor } from './identity';

/**
 * Relatório pós-partida: transforma a linha do tempo de uma partida em poucos
 * pontos acionáveis ("você estava 800 de ouro atrás aos 15 min", "3 de 5
 * mortes no rio"). Cada ponto aponta uma aula da LOI Academy.
 *
 * Sem `analysis` (linha do tempo indisponível) o relatório usa só o placar e
 * os eventos da partida, e informa que está incompleto.
 */

export type Zone = 'TOP' | 'MID' | 'BOT' | 'RIVER' | 'OWN_JUNGLE' | 'ENEMY_JUNGLE' | 'OWN_BASE' | 'ENEMY_BASE';

export const ZONE_LABEL: Record<Zone, string> = {
  TOP: 'rota do topo',
  MID: 'rota do meio',
  BOT: 'rota inferior',
  RIVER: 'rio',
  OWN_JUNGLE: 'sua selva',
  ENEMY_JUNGLE: 'selva inimiga',
  OWN_BASE: 'sua base',
  ENEMY_BASE: 'base inimiga',
};

/** Região do mapa de um ponto, do ponto de vista da equipe do jogador. */
export function zoneOf(p: MapPoint, team: 'BLUE' | 'RED'): Zone {
  const mine = (blueSide: boolean) => blueSide === (team === 'BLUE');
  if (p.x < 0.2 && p.y < 0.2) return mine(true) ? 'OWN_BASE' : 'ENEMY_BASE';
  if (p.x > 0.8 && p.y > 0.8) return mine(false) ? 'OWN_BASE' : 'ENEMY_BASE';
  if (p.x < 0.14 || p.y > 0.86) return 'TOP';
  if (p.y < 0.14 || p.x > 0.86) return 'BOT';
  if (Math.abs(p.x - p.y) < 0.09) return 'MID';
  if (Math.abs(p.x + p.y - 1) < 0.09) return 'RIVER';
  return mine(p.x + p.y < 1) ? 'OWN_JUNGLE' : 'ENEMY_JUNGLE';
}

export interface ReportPoint {
  key: string;
  tone: 'good' | 'bad';
  title: string;
  detail: string;
  /** Importância (0–100): ordena os pontos. */
  weight: number;
  /** Aula da Academy relacionada. */
  lessonId?: string;
}

export interface LaneDiff {
  minute: number;
  gold: number;
  cs: number;
}

export interface MatchReport {
  headline: string;
  /** Os três pontos principais (até dois a corrigir e um positivo, quando houver). */
  points: ReportPoint[];
  improvements: ReportPoint[];
  strengths: ReportPoint[];
  at10: LaneDiff | null;
  at15: LaneDiff | null;
  opponentName: string;
  /** false quando a linha do tempo não estava disponível. */
  complete: boolean;
}

const diffAt = (a: MatchAnalysis, minute: number): LaneDiff | null => {
  const f = a.frames.find((x) => x.minute === minute);
  return f ? { minute, gold: f.goldDiff, cs: f.csDiff } : null;
};
const minutesList = (xs: number[]) => {
  const ms = xs.map((x) => Math.floor(x));
  return ms.length <= 1 ? `${ms[0]}` : `${ms.slice(0, -1).join(', ')} e ${ms[ms.length - 1]}`;
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const cap = (n: number) => Math.min(98, Math.round(n));

export function buildMatchReport(m: Match, analysis?: MatchAnalysis | null, tier?: Tier | null): MatchReport {
  const opp = champion(m.opponentChampionId).name;
  const minutes = m.durationSec / 60;
  const support = m.position === 'SUPPORT';
  const farmer = m.position !== 'SUPPORT' && m.position !== 'JUNGLE';
  const pts: ReportPoint[] = [];
  const add = (p: ReportPoint) => pts.push({ ...p, weight: cap(p.weight) });

  const a = analysis ?? null;
  const at10 = a ? diffAt(a, 10) : null;
  const at15 = a ? (diffAt(a, 15) ?? diffAt(a, Math.min(14, a.frames.length - 1))) : null;

  if (a) {
    // Fase de rotas
    if (at15 && at15.gold <= -700) {
      add({
        key: 'lane-behind',
        tone: 'bad',
        title: `Atrás na rota aos ${at15.minute} min`,
        detail: `${signed(at15.gold)} de ouro${support ? '' : ` e ${signed(at15.cs)} CS`} em relação a ${opp}.`,
        weight: 50 + Math.abs(at15.gold) / 40,
        lessonId: 'r-primeiros-10',
      });
    } else if (at15 && at15.gold >= 700) {
      add({
        key: 'lane-ahead',
        tone: 'good',
        title: `Fase de rotas vencida`,
        detail: `${signed(at15.gold)} de ouro sobre ${opp} aos ${at15.minute} min.`,
        weight: 45 + at15.gold / 50,
        lessonId: 'r-aproveitar-vantagem',
      });
    }
    if (farmer && at10 && at10.cs <= -12) {
      add({
        key: 'cs-10',
        tone: 'bad',
        title: 'Farm abaixo do oponente',
        detail: `${signed(at10.cs)} CS aos 10 min contra ${opp}: cerca de ${int(Math.abs(at10.cs) * 21)} de ouro a menos só em tropas.`,
        weight: 42 + Math.abs(at10.cs) * 1.5,
        lessonId: 'f-last-hit',
      });
    }

    // Mortes
    const deaths = a.deaths;
    const early = deaths.filter((d) => d.minute < 14);
    if (early.length >= 2) {
      add({
        key: 'early-deaths',
        tone: 'bad',
        title: 'Mortes cedo demais',
        detail: `${plural(early.length, 'morte', 'mortes')} antes dos 14 min (minutos ${minutesList(early.map((d) => d.minute))}). Cada uma custa ouro, experiência e tropas na rota.`,
        weight: 40 + early.length * 12,
        lessonId: 'r-evitar-ganks',
      });
    }
    const exposed = deaths.filter((d) => {
      const z = zoneOf(d, a.playerTeam);
      return z === 'RIVER' || z === 'ENEMY_JUNGLE';
    });
    if (exposed.length >= 2 && exposed.length / deaths.length >= 0.4) {
      add({
        key: 'exposed-deaths',
        tone: 'bad',
        title: 'Mortes em território exposto',
        detail: `${exposed.length} de ${deaths.length} mortes foram no rio ou na selva inimiga, áreas onde costuma faltar visão.`,
        weight: 45 + exposed.length * 9,
        lessonId: 'f-visao',
      });
    }
    const outnumbered = deaths.filter((d) => d.enemiesInvolved >= 3);
    if (outnumbered.length >= 2) {
      add({
        key: 'outnumbered',
        tone: 'bad',
        title: 'Pego em desvantagem numérica',
        detail: `Em ${plural(outnumbered.length, 'morte', 'mortes')}, 3 ou mais inimigos participaram do abate.`,
        weight: 38 + outnumbered.length * 8,
        lessonId: outnumbered.every((d) => d.minute >= 15) ? 'c-posicionamento-tf' : 'f-posicionamento',
      });
    }
    const solo = deaths.filter((d) => d.enemiesInvolved <= 1);
    if (solo.length >= 2) {
      add({
        key: 'solo-deaths',
        tone: 'bad',
        title: 'Duelos perdidos',
        detail: `${plural(solo.length, 'morte', 'mortes')} sem ajuda de outros inimigos: trocas e duelos que não deveriam ter acontecido.`,
        weight: 36 + solo.length * 8,
        lessonId: 'r-quando-trocar',
      });
    }

    // Visão
    const wpm = a.wardsPlaced.length / Math.max(1, minutes);
    const ref = support ? 1.0 : m.position === 'JUNGLE' ? 0.55 : 0.38;
    if (wpm < ref * 0.65 && minutes >= 18) {
      add({
        key: 'low-wards',
        tone: 'bad',
        title: 'Pouca visão colocada',
        detail: `${plural(a.wardsPlaced.length, 'sentinela', 'sentinelas')} em ${Math.round(minutes)} min (${dec(wpm, 2)}/min). Referência do LOL Insight para a posição: ~${dec(ref, 2)}/min.`,
        weight: 34 + (1 - wpm / ref) * 30,
        lessonId: 'f-visao',
      });
    }
    if (a.wardsKilled.length >= 4) {
      add({
        key: 'ward-kills',
        tone: 'good',
        title: 'Negou a visão inimiga',
        detail: `${a.wardsKilled.length} sentinelas inimigas destruídas.`,
        weight: 30 + a.wardsKilled.length * 3,
        lessonId: 'f-visao',
      });
    }

    // Vantagem desperdiçada / virada
    const peak = Math.max(0, ...a.frames.map((f) => f.goldDiff));
    const low = Math.min(0, ...a.frames.map((f) => f.goldDiff));
    if (!m.win && peak >= 1000) {
      add({
        key: 'thrown-lead',
        tone: 'bad',
        title: 'Vantagem desperdiçada',
        detail: `Chegou a ${signed(peak)} de ouro sobre ${opp}, mas a partida escapou.`,
        weight: 62,
        lessonId: 'r-aproveitar-vantagem',
      });
    }
    if (m.win && low <= -1000) {
      add({
        key: 'comeback',
        tone: 'good',
        title: 'Virada',
        detail: `Esteve ${signed(low)} de ouro atrás de ${opp} e ainda assim venceu.`,
        weight: 52,
        lessonId: 'r-jogar-atras',
      });
    }
  }

  // Mortes antes de objetivos (usa só os eventos da partida)
  const deathMins = m.timeline.filter((e) => e.kind === 'DEATH').map((e) => e.minute);
  const lostObjectives = m.timeline.filter(
    (e) => (e.kind === 'DRAGON' || e.kind === 'BARON' || e.kind === 'HERALD') && !e.positive && deathMins.some((d) => e.minute - d >= 0 && e.minute - d <= 2),
  );
  if (lostObjectives.length) {
    const names = lostObjectives.map((e) => `${e.kind === 'DRAGON' ? 'Dragão' : e.kind === 'BARON' ? 'Barão' : 'Arauto'} aos ${e.minute} min`);
    add({
      key: 'death-before-objective',
      tone: 'bad',
      title: 'Mortes antes de objetivos',
      detail: `Você morreu pouco antes de a equipe inimiga garantir ${plural(lostObjectives.length, 'objetivo', 'objetivos')} (${names.join(', ')}).`,
      weight: 55 + lostObjectives.length * 10,
      lessonId: lostObjectives.some((e) => e.kind === 'BARON') ? 'm-arauto-barao' : 'm-dragoes',
    });
  }

  // Placar
  // Dados inconsistentes (ex.: abates da equipe mal informados) não podem passar de 100%.
  const kp = Math.min(1, matchKp(m));
  if (kp >= 0.65) {
    add({ key: 'kp-high', tone: 'good', title: 'Presente nas lutas', detail: `Participou de ${pct(kp)} dos abates da equipe.`, weight: 35 + (kp - 0.65) * 120, lessonId: 'm-rotacoes' });
  } else if (kp < 0.35 && m.teamKills >= 10) {
    add({ key: 'kp-low', tone: 'bad', title: 'Longe das lutas', detail: `Participou de apenas ${pct(kp)} dos abates da equipe.`, weight: 40 + (0.35 - kp) * 120, lessonId: 'm-rotacoes' });
  }
  if (m.deaths <= 2 && minutes >= 22) {
    add({ key: 'few-deaths', tone: 'good', title: 'Jogou com segurança', detail: `Apenas ${plural(m.deaths, 'morte', 'mortes')} em ${Math.round(minutes)} min.`, weight: 40 - m.deaths * 4, lessonId: 'f-posicionamento' });
  }
  if (farmer) {
    const ratio = matchCsPerMin(m) / benchFor(m.position, tier).cs;
    if (ratio >= 1.08) {
      add({ key: 'farm-good', tone: 'good', title: 'Farm acima da referência', detail: `${dec(matchCsPerMin(m))} CS/min, ${pct(ratio - 1)} acima da referência do seu elo.`, weight: 30 + (ratio - 1) * 100, lessonId: 'f-last-hit' });
    }
  }

  const improvements = pts.filter((p) => p.tone === 'bad').sort((x, y) => y.weight - x.weight);
  const strengths = pts.filter((p) => p.tone === 'good').sort((x, y) => y.weight - x.weight);
  const points = [...improvements.slice(0, strengths.length ? 2 : 3), ...strengths.slice(0, 1)];
  if (points.length < 3) points.push(...[...improvements, ...strengths].filter((p) => !points.includes(p)).slice(0, 3 - points.length));

  const top = improvements[0];
  const headline = m.win
    ? top
      ? `Vitória, mas com um ponto a corrigir: ${top.title.toLowerCase()}.`
      : 'Vitória sólida, sem erros recorrentes nesta partida.'
    : top
      ? `Derrota. O que mais pesou: ${top.title.toLowerCase()}.`
      : 'Derrota sem um erro individual claro: a partida foi decidida no coletivo.';

  return { headline, points, improvements, strengths, at10, at15, opponentName: opp, complete: !!a };
}
