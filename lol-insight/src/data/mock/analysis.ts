import { Rng } from '@/data/prng';
import type { AnalysisDeath, MapPoint, Match, MatchAnalysis, Position } from '@/types';

/**
 * Linha do tempo detalhada das partidas DEMONSTRATIVAS (posições das mortes,
 * ouro e CS minuto a minuto, sentinelas). Gerada sob demanda e de forma
 * determinística a partir do id da partida, coerente com o placar e com os
 * minutos de morte da linha do tempo já existente.
 */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const clamp = (v: number, a = 0.03, b = 0.97) => Math.min(b, Math.max(a, v));

/** Pontos de referência do mapa (equipe azul embaixo à esquerda). */
const SPOTS = {
  topLane: [{ x: 0.1, y: 0.62 }, { x: 0.12, y: 0.82 }, { x: 0.3, y: 0.9 }],
  midLane: [{ x: 0.42, y: 0.42 }, { x: 0.5, y: 0.5 }, { x: 0.58, y: 0.58 }],
  botLane: [{ x: 0.62, y: 0.1 }, { x: 0.82, y: 0.12 }, { x: 0.9, y: 0.3 }],
  river: [{ x: 0.32, y: 0.68 }, { x: 0.68, y: 0.32 }, { x: 0.4, y: 0.6 }, { x: 0.6, y: 0.4 }],
  blueJungle: [{ x: 0.25, y: 0.45 }, { x: 0.45, y: 0.25 }, { x: 0.22, y: 0.3 }, { x: 0.52, y: 0.2 }],
  redJungle: [{ x: 0.75, y: 0.55 }, { x: 0.55, y: 0.75 }, { x: 0.78, y: 0.7 }, { x: 0.48, y: 0.8 }],
};
const LANE: Record<Position, MapPoint[]> = {
  TOP: SPOTS.topLane,
  MID: SPOTS.midLane,
  ADC: SPOTS.botLane,
  SUPPORT: SPOTS.botLane,
  JUNGLE: [...SPOTS.blueJungle, ...SPOTS.redJungle],
};

export function demoAnalysis(m: Match): MatchAnalysis {
  const rng = new Rng(hash(m.id));
  const blue = m.participants.find((p) => p.isPlayer)?.team !== 'RED';
  const me = m.participants.find((p) => p.isPlayer);
  const opp = m.participants.find((p) => !p.isPlayer && p.team !== me?.team && p.position === m.position);
  const minutes = Math.floor(m.durationSec / 60);

  // Pontos do mapa ficam do ponto de vista da equipe azul; para o lado vermelho, espelha.
  const own = (p: MapPoint): MapPoint => (blue ? p : { x: 1 - p.x, y: 1 - p.y });
  const jitter = (p: MapPoint): MapPoint => ({ x: clamp(p.x + rng.normal(0, 0.035)), y: clamp(p.y + rng.normal(0, 0.035)) });
  const enemyJungle = blue ? SPOTS.redJungle : SPOTS.blueJungle;

  // Ouro e CS: passeio aleatório com tendência que termina perto da diferença final.
  const goldEnd = (m.gold - (opp?.gold ?? m.gold)) * 0.85;
  const csEnd = m.cs - (opp?.cs ?? m.cs);
  const frames: MatchAnalysis['frames'] = [];
  let g = 0;
  let c = 0;
  const deathMinutes = m.timeline.filter((e) => e.kind === 'DEATH').map((e) => e.minute);
  const killMinutes = m.timeline.filter((e) => e.kind === 'KILL').map((e) => e.minute);
  for (let t = 0; t <= minutes; t++) {
    const k = t / Math.max(1, minutes);
    const pull = 0.25;
    g += (goldEnd * k - g) * pull + rng.normal(0, 70 + t * 6);
    c += (csEnd * k - c) * pull + rng.normal(0, 1.4);
    g += killMinutes.filter((x) => x === t).length * 220 - deathMinutes.filter((x) => x === t).length * 260;
    const cs = Math.round(m.cs * Math.min(1, t / Math.max(1, minutes)));
    frames.push({ minute: t, goldDiff: t === 0 ? 0 : Math.round(g), csDiff: t === 0 ? 0 : Math.round(c), xpDiff: t === 0 ? 0 : Math.round(g * 0.6), cs });
  }

  const deaths: AnalysisDeath[] = deathMinutes.map((minute) => {
    const early = minute < 14;
    const spot = rng.weighted([
      { w: early ? 5 : 2, v: LANE[m.position] },
      { w: early ? 2 : 4, v: SPOTS.river },
      { w: early ? 1 : 3, v: enemyJungle },
      { w: 1, v: blue ? SPOTS.blueJungle : SPOTS.redJungle },
    ]);
    const p = jitter(spot === enemyJungle || spot === SPOTS.river ? rng.pick(spot) : own(rng.pick(spot)));
    const enemiesInvolved = rng.weighted([{ w: 3, v: 1 }, { w: 4, v: 2 }, { w: early ? 1 : 3, v: 3 }, { w: early ? 0.3 : 1.5, v: 4 }]);
    const killer = m.participants.filter((x) => x.team !== me?.team);
    return { ...p, minute: minute + rng.range(0, 0.95), killerChampionId: rng.pick(killer).championId, enemiesInvolved };
  });
  const kills = killMinutes.map((minute) => ({ ...jitter(own(rng.pick([...LANE[m.position], ...SPOTS.river]))), minute: minute + rng.range(0, 0.95) }));

  const wardCount = Math.max(1, Math.round(m.visionScore / (m.position === 'SUPPORT' ? 2.2 : 2.8)));
  const wardsPlaced = Array.from({ length: wardCount }, () => Math.round(rng.range(1.5, minutes) * 10) / 10).sort((a, b) => a - b);
  const wardsKilled = Array.from({ length: Math.round(wardCount * rng.range(0.15, 0.45)) }, () => Math.round(rng.range(4, minutes) * 10) / 10).sort((a, b) => a - b);

  return { frames, deaths: deaths.sort((a, b) => a.minute - b.minute), kills, wardsPlaced, wardsKilled, playerTeam: blue ? 'BLUE' : 'RED' };
}
