import { CHAMPIONS, champion, championsByPosition, POSITIONS } from '@/data/champions';
import { buildFor, runesFor } from '@/data/items';
import { Rng } from '@/data/prng';
import { absoluteToRank, rankToAbsolute } from '@/stats/rank';
import type {
  Match,
  Objectives,
  Participant,
  Player,
  PlayerBundle,
  Position,
  QueueType,
  TimelineEvent,
} from '@/types';

/**
 * Gerador determinístico de histórico de partidas.
 *
 * Cada conta demonstrativa é descrita por um perfil (pool de campeões, hábitos de
 * horário, tendência a "tiltar"...). A partir de uma semente fixa o gerador simula
 * as sessões de jogo dos últimos 90 dias. Nada aqui é sorteado em tempo de
 * renderização: a mesma semente produz exatamente o mesmo histórico.
 *
 * Todas as estatísticas exibidas no app são CALCULADAS a partir destas partidas
 * (ver src/stats), então os números são sempre coerentes entre si.
 */

export interface PoolEntry {
  championId: string;
  position: Position;
  /** Peso de escolha do campeão. */
  weight: number;
  /** Ajuste na probabilidade de vitória (domínio do campeão). */
  skill: number;
}

export interface PlayerProfile {
  seed: number;
  player: Player;
  pool: PoolEntry[];
  baseWinRate: number;
  /** Bônus/penalidade de probabilidade de vitória por faixa de horário. */
  hourEffect: (hour: number) => number;
  /** Pesos dos horários de início de sessão. */
  sessionHours: Array<{ w: number; v: [number, number] }>;
  days: number;
  asOf: number;
}

const NICKS = [
  'Kaelthas', 'NoxFury', 'MidOuAFK', 'Tormenta', 'Zephyrus', 'LunaNegra', 'Baiano77', 'xKiraa', 'Vortex', 'Solari',
  'DragãoRubro', 'Pixelado', 'ShenDoMal', 'Aurelion', 'Tucano', 'Nyx', 'GankSemFim', 'Faísca', 'Orbital', 'Mirage',
  'Capivara', 'SrWard', 'Hexa', 'Brisa', 'Kyoto', 'Trovão', 'Farmador', 'Lótus', 'Rift', 'Eclipse99',
];

const KDA_BASE: Record<Position, [number, number, number]> = {
  MID: [7.0, 4.6, 6.8],
  JUNGLE: [6.0, 5.0, 9.0],
  ADC: [7.4, 5.0, 6.4],
  SUPPORT: [1.8, 5.4, 13.5],
  TOP: [5.0, 5.0, 5.4],
};
const CS_BASE: Record<Position, number> = { MID: 7.6, TOP: 7.2, ADC: 8.0, JUNGLE: 6.0, SUPPORT: 1.2 };
const DPM_BASE: Record<Position, number> = { MID: 760, ADC: 740, TOP: 620, JUNGLE: 540, SUPPORT: 270 };
const DTPM_BASE: Record<Position, number> = { MID: 520, ADC: 470, TOP: 900, JUNGLE: 840, SUPPORT: 560 };
const VISION_BASE: Record<Position, number> = { MID: 0.72, ADC: 0.68, TOP: 0.66, JUNGLE: 1.15, SUPPORT: 2.45 };
const KILL_SHARE: Record<Position, number> = { MID: 1.2, ADC: 1.3, TOP: 1.0, JUNGLE: 1.0, SUPPORT: 0.3 };

const SKILL_PRIORITY: Record<string, Array<'Q' | 'W' | 'E'>> = {
  Leblanc: ['W', 'Q', 'E'],
  Ahri: ['Q', 'W', 'E'],
  Syndra: ['Q', 'W', 'E'],
  Orianna: ['Q', 'W', 'E'],
  Jinx: ['Q', 'W', 'E'],
  LeeSin: ['Q', 'W', 'E'],
  Jax: ['W', 'Q', 'E'],
  Lulu: ['E', 'W', 'Q'],
  Kaisa: ['Q', 'E', 'W'],
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Divide `total` em inteiros proporcionais aos pesos (soma exata). */
function distribute(rng: Rng, total: number, weights: number[]): number[] {
  const out = weights.map(() => 0);
  const items = weights.map((w, i) => ({ w, v: i }));
  for (let i = 0; i < total; i++) out[rng.weighted(items)]++;
  return out;
}

function skillOrderFor(championId: string, level: number): Array<'Q' | 'W' | 'E' | 'R'> {
  const [a, b, c] = SKILL_PRIORITY[championId] ?? ['Q', 'E', 'W'];
  const order: Array<'Q' | 'W' | 'E' | 'R'> = [];
  const count = { Q: 0, W: 0, E: 0, R: 0 };
  for (let lvl = 1; lvl <= 18; lvl++) {
    let s: 'Q' | 'W' | 'E' | 'R';
    if (lvl === 6 || lvl === 11 || lvl === 16) s = 'R';
    else if (lvl === 1) s = a;
    else if (lvl === 2) s = b;
    else if (lvl === 3) s = c;
    else if (count[a] < 5) s = a;
    else if (count[b] < 5) s = b;
    else s = c;
    count[s]++;
    order.push(s);
  }
  return order.slice(0, level);
}

export function generateBundle(profile: PlayerProfile): PlayerBundle {
  const rng = new Rng(profile.seed);
  const { asOf } = profile;
  const end = new Date(asOf);
  const drafts: Array<Omit<Match, 'rankAfter'>> = [];

  for (let d = profile.days - 1; d >= 0; d--) {
    const day = new Date(end.getFullYear(), end.getMonth(), end.getDate() - d);
    const dow = day.getDay();
    const weekend = dow === 0 || dow === 5 || dow === 6;
    if (!rng.chance(weekend ? 0.8 : 0.56)) continue;

    const games = rng.weighted(
      weekend
        ? [{ w: 2, v: 1 }, { w: 4, v: 2 }, { w: 4, v: 3 }, { w: 3, v: 4 }, { w: 1, v: 5 }]
        : [{ w: 4, v: 1 }, { w: 5, v: 2 }, { w: 3, v: 3 }, { w: 1, v: 4 }],
    );
    const [h0, h1] = rng.weighted(profile.sessionHours);
    let cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate(), rng.int(h0, h1), rng.int(0, 59)).getTime();
    let lossStreak = 0;
    const sessionQueue: QueueType = rng.weighted([{ w: 78, v: 'SOLO' }, { w: 12, v: 'FLEX' }, { w: 10, v: 'NORMAL' }]);

    // Sessões se estendem quando o jogador tenta "recuperar" derrotas seguidas.
    let remaining = games;
    let extra = 0;
    while (remaining > 0 || (lossStreak >= 2 && extra < 3 && rng.chance(0.62) && ++extra > 0)) {
      remaining--;
      const hour = new Date(cursor).getHours();
      const pick = rng.weighted(profile.pool.map((p) => ({ w: p.weight, v: p })));
      const champ = champion(pick.championId);
      const pos = pick.position;
      const cls = champ.classes[0];

      const firstBlood = rng.chance(pos === 'SUPPORT' ? 0.2 : 0.3);
      let p = profile.baseWinRate + pick.skill + profile.hourEffect(hour);
      if (lossStreak >= 3) p -= 0.2;
      else if (lossStreak === 2) p -= 0.05;
      if (firstBlood) p += 0.14;
      const win = rng.chance(clamp(p, 0.08, 0.92));

      const durMin = clamp(rng.normal(30.5, 5), 16.5, 45);
      const durationSec = Math.round(durMin * 60);
      const scale = durMin / 30;
      const tilt = lossStreak >= 3 ? 1.25 : 1;
      const mastery = 1 + pick.skill * 1.6;

      const [bk, bd, ba] = KDA_BASE[pos];
      let kills = Math.round(bk * (win ? 1.25 : 0.74) * mastery * rng.range(0.45, 1.55) * scale);
      const deaths = Math.round((bd * (win ? 0.72 : 1.3) * tilt * rng.range(0.5, 1.5) * scale) / mastery);
      const assists = Math.round(ba * (win ? 1.2 : 0.8) * rng.range(0.5, 1.5) * scale);
      if (firstBlood && kills < 1) kills = 1;

      const recent = d < 4; // leve queda de farm nas sessões mais recentes
      const csPerMin = clamp(
        rng.normal(CS_BASE[pos] + (win ? 0.25 : -0.15) + pick.skill * 2 - (recent && pos !== 'SUPPORT' ? 0.55 : 0), 0.55),
        pos === 'SUPPORT' ? 0.5 : 4.2,
        pos === 'SUPPORT' ? 2.4 : 10,
      );
      const cs = Math.round(csPerMin * durMin);
      const gold = Math.round(
        durMin * (pos === 'SUPPORT' ? 175 : 165) + cs * 20.5 + kills * 300 + assists * 95 + (win ? durMin * 22 : 0),
      );
      const fight = 0.72 + clamp((kills + assists * 0.5) / (10 * scale), 0, 1.4) * 0.38;
      const damageDealt = Math.round(DPM_BASE[pos] * durMin * fight * mastery * rng.range(0.85, 1.15));
      const damageTaken = Math.round(DTPM_BASE[pos] * durMin * (0.8 + deaths / (12 * scale)) * rng.range(0.85, 1.15));
      const visionScore = Math.round(VISION_BASE[pos] * durMin * rng.range(0.75, 1.3));

      // Abates das equipes — mantidos coerentes com K/D/A do jogador.
      const kp = clamp(rng.normal(pos === 'SUPPORT' ? 0.63 : 0.58, 0.075) + (win ? 0.02 : -0.02), 0.3, 0.86);
      const teamKills = Math.max(kills + Math.ceil(assists * 0.6), Math.round((kills + assists) / kp), win ? 12 : 5);
      const enemyKills = Math.max(
        deaths + 3,
        Math.round(teamKills * (win ? rng.range(0.45, 0.85) : rng.range(1.2, 1.75))),
      );

      // Composição das equipes
      const used = new Set<string>([champ.id]);
      const pickChamp = (position: Position) => {
        const options = championsByPosition(position).filter((c) => !used.has(c.id));
        const c = options.length ? rng.pick(options) : rng.pick(Object.values(CHAMPIONS).filter((x) => !used.has(x.id)));
        used.add(c.id);
        return c.id;
      };
      const nickStart = rng.int(0, NICKS.length - 1);
      const playerTeam: 'BLUE' | 'RED' = rng.chance(0.5) ? 'BLUE' : 'RED';
      const enemyTeam = playerTeam === 'BLUE' ? 'RED' : 'BLUE';
      const allyPositions = POSITIONS.filter((x) => x !== pos);
      const allyKills = distribute(rng, teamKills - kills, allyPositions.map((x) => KILL_SHARE[x]));
      const allyDeaths = distribute(rng, enemyKills - deaths, allyPositions.map(() => 1));
      const foeKills = distribute(rng, enemyKills, POSITIONS.map((x) => KILL_SHARE[x]));
      const foeDeaths = distribute(rng, teamKills, POSITIONS.map(() => 1));

      const mkOther = (
        team: 'BLUE' | 'RED',
        position: Position,
        k: number,
        dd: number,
        tKills: number,
        won: boolean,
        idx: number,
      ): Participant => {
        const cid = pickChamp(position);
        const a = Math.min(tKills - k, Math.round((tKills - k) * rng.range(position === 'SUPPORT' ? 0.55 : 0.3, position === 'SUPPORT' ? 0.85 : 0.65)));
        const cpm = clamp(rng.normal(CS_BASE[position] - 0.4, 0.6), position === 'SUPPORT' ? 0.5 : 4, 9.5);
        const pcs = Math.round(cpm * durMin);
        const f = 0.72 + clamp((k + a * 0.5) / (10 * scale), 0, 1.4) * 0.38;
        return {
          name: NICKS[(nickStart + idx) % NICKS.length],
          championId: cid,
          team,
          position,
          kills: k,
          deaths: dd,
          assists: a,
          cs: pcs,
          gold: Math.round(durMin * (position === 'SUPPORT' ? 175 : 165) + pcs * 20.5 + k * 300 + a * 95 + (won ? durMin * 22 : 0)),
          damage: Math.round(DPM_BASE[position] * durMin * f * rng.range(0.8, 1.15)),
          isPlayer: false,
        };
      };

      const participants: Participant[] = [];
      let idx = 0;
      for (const position of POSITIONS) {
        if (position === pos) {
          participants.push({
            name: profile.player.gameName,
            championId: champ.id,
            team: playerTeam,
            position,
            kills,
            deaths,
            assists,
            cs,
            gold,
            damage: damageDealt,
            isPlayer: true,
          });
        } else {
          const i = allyPositions.indexOf(position);
          participants.push(mkOther(playerTeam, position, allyKills[i], allyDeaths[i], teamKills, win, idx++));
        }
      }
      POSITIONS.forEach((position, i) => {
        participants.push(mkOther(enemyTeam, position, foeKills[i], foeDeaths[i], enemyKills, !win, idx++));
      });
      const opponent = participants.find((x) => x.team === enemyTeam && x.position === pos)!;

      // Objetivos
      const long = durMin > 22;
      const dragons = win ? rng.int(2, 4) : rng.int(0, 2);
      const enemyDragons = win ? rng.int(0, 2) : rng.int(2, 4);
      const barons = long ? (win ? rng.int(0, 2) : rng.int(0, 1) * (rng.chance(0.3) ? 1 : 0)) : 0;
      const enemyBarons = long ? (win ? (rng.chance(0.15) ? 1 : 0) : rng.int(0, 2)) : 0;
      const heralds = rng.chance(win ? 0.65 : 0.35) ? 1 : 0;
      const towers = win ? rng.int(7, 11) : rng.int(1, 6);
      const enemyTowers = win ? rng.int(0, 5) : rng.int(7, 11);
      const objTotal = dragons + barons + heralds;
      const objectives: Objectives = {
        dragons,
        barons,
        heralds,
        towers,
        enemyDragons,
        enemyBarons,
        enemyTowers,
        playerParticipations: Math.min(objTotal, Math.round(objTotal * rng.range(pos === 'JUNGLE' ? 0.75 : 0.35, pos === 'JUNGLE' ? 1 : 0.8))),
      };

      // Itens
      const build = buildFor(cls, pos);
      const nItems = durMin < 22 ? 2 : durMin < 28 ? 3 : durMin < 34 ? 4 : 5;
      const core = [...build.core];
      for (let i = core.length - 1; i > 2; i--) {
        const j = rng.int(2, i);
        [core[i], core[j]] = [core[j], core[i]];
      }
      const items = [core[0], build.boots, ...core.slice(1, nItems)];

      // Linha do tempo
      const timeline: TimelineEvent[] = [];
      const lastMin = Math.floor(durMin) - 1;
      const enemies = participants.filter((x) => x.team === enemyTeam);
      const minute = (lo: number) => rng.int(Math.min(lo, lastMin), lastMin);
      for (let i = 0; i < kills; i++) {
        const fb = firstBlood && i === 0;
        timeline.push({
          minute: fb ? rng.int(2, 4) : minute(5),
          kind: 'KILL',
          text: `${fb ? 'Primeiro abate: eliminou' : 'Eliminou'} ${champion(rng.pick(enemies).championId).name}`,
          positive: true,
        });
      }
      for (let i = 0; i < deaths; i++) {
        timeline.push({
          minute: minute(4),
          kind: 'DEATH',
          text: `Foi eliminado por ${champion(rng.pick(enemies).championId).name}`,
          positive: false,
        });
      }
      const objEvents = (n: number, kind: 'DRAGON' | 'BARON' | 'HERALD', lo: number, label: string, ours: boolean) => {
        for (let i = 0; i < n; i++) {
          timeline.push({
            minute: minute(lo + i * 5),
            kind,
            text: ours ? `Sua equipe garantiu ${label}` : `Equipe inimiga garantiu ${label}`,
            positive: ours,
          });
        }
      };
      objEvents(dragons, 'DRAGON', 6, 'um Dragão', true);
      objEvents(enemyDragons, 'DRAGON', 6, 'um Dragão', false);
      objEvents(heralds, 'HERALD', 9, 'o Arauto do Vale', true);
      objEvents(barons, 'BARON', 21, 'o Barão Na\'Shor', true);
      objEvents(enemyBarons, 'BARON', 21, 'o Barão Na\'Shor', false);
      const firstTowerOurs = win ? rng.chance(0.68) : rng.chance(0.35);
      timeline.push({
        minute: rng.int(10, Math.min(15, lastMin)),
        kind: 'TOWER',
        text: firstTowerOurs ? 'Sua equipe destruiu a primeira torre' : 'Equipe inimiga destruiu a primeira torre',
        positive: firstTowerOurs,
      });
      timeline.push({ minute: Math.round(durMin * 0.38), kind: 'ITEM', text: 'Concluiu o primeiro item', positive: true });
      timeline.sort((x, y) => x.minute - y.minute);
      timeline.push({ minute: Math.floor(durMin), kind: 'END', text: win ? 'Nexus inimigo destruído' : 'Nexus aliado destruído', positive: win });

      const level = clamp(Math.round(5.5 + durMin / 2.5), 9, 18);
      drafts.push({
        id: `${profile.player.region}1_${(3_104_000_000 + drafts.length * 7919 + profile.seed).toString()}`,
        timestamp: cursor,
        durationSec,
        queue: sessionQueue,
        win,
        championId: champ.id,
        position: pos,
        opponentChampionId: opponent.championId,
        kills,
        deaths,
        assists,
        cs,
        gold,
        damageDealt,
        damageTaken,
        visionScore,
        teamKills,
        firstBlood,
        lpDelta: sessionQueue === 'SOLO' ? (win ? rng.int(18, 24) : -rng.int(15, 21)) : undefined,
        items,
        trinket: build.trinket,
        runes: runesFor(cls),
        skillOrder: skillOrderFor(champ.id, level),
        participants,
        objectives,
        timeline,
      });

      lossStreak = win ? 0 : lossStreak + 1;
      cursor += durationSec * 1000 + rng.int(5, 11) * 60_000;
    }
  }

  const played = drafts.filter((m) => m.timestamp + m.durationSec * 1000 <= asOf);

  // Reconstrói o elo partida a partida, terminando exatamente no elo atual da conta.
  const totalDelta = played.reduce((s, m) => s + (m.lpDelta ?? 0), 0);
  let abs = rankToAbsolute(profile.player.rank) - totalDelta;
  const matches: Match[] = played.map((m) => {
    if (m.lpDelta === undefined) return m;
    abs += m.lpDelta;
    return { ...m, rankAfter: absoluteToRank(abs) };
  });

  return { player: profile.player, matches, asOf };
}
