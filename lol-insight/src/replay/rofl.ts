/**
 * Leitura de arquivos de replay do League of Legends (.rofl).
 *
 * O que é possível, de verdade: o arquivo começa com a assinatura "RIOT" e traz
 * um bloco de METADADOS em JSON aberto (duração, versão do jogo e as
 * estatísticas finais dos 10 jogadores em "statsJson"). Isso é lido aqui, no
 * próprio navegador, sem enviar o arquivo a lugar nenhum.
 *
 * O que NÃO é possível: o restante do arquivo (posições, eventos, câmera) é um
 * fluxo de pacotes de rede criptografado e comprimido, cujo formato muda a cada
 * patch e não é documentado pela Riot. O LOL Insight não tenta decodificá-lo.
 */

export interface RoflPlayer {
  name: string;
  champion: string;
  team: 'BLUE' | 'RED';
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage: number;
  vision: number;
  position: string;
  level: number;
}

export interface RoflMetadata {
  gameLengthSec: number;
  gameVersion: string;
  players: RoflPlayer[];
  /** Bytes lidos do arquivo. */
  size: number;
}

export class RoflError extends Error {}

const MAGIC = [0x52, 0x49, 0x4f, 0x54]; // "RIOT"
const NEEDLE = '{"gameLength"';

function findBytes(buf: Uint8Array, text: string, from: number, to: number): number {
  const pat = Array.from(text, (ch) => ch.charCodeAt(0));
  outer: for (let i = Math.max(0, from); i <= Math.min(buf.length, to) - pat.length; i++) {
    for (let j = 0; j < pat.length; j++) if (buf[i + j] !== pat[j]) continue outer;
    return i;
  }
  return -1;
}

/** Fecha o objeto JSON que começa em `start`, respeitando strings e escapes. */
function jsonEnd(buf: Uint8Array, start: number): number {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < buf.length; i++) {
    const c = buf[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === 0x5c) esc = true;
      else if (c === 0x22) inStr = false;
      continue;
    }
    if (c === 0x22) inStr = true;
    else if (c === 0x7b) depth++;
    else if (c === 0x7d && --depth === 0) return i + 1;
  }
  return -1;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function parseRofl(input: ArrayBuffer | Uint8Array): RoflMetadata {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (buf.length < 16 || !MAGIC.every((b, i) => buf[i] === b)) throw new RoflError('Este arquivo não parece um replay do League of Legends (assinatura "RIOT" ausente).');
  // Os metadados ficam no começo (formato antigo) ou no fim (formato novo) do arquivo.
  const WINDOW = 4 * 1024 * 1024;
  let at = findBytes(buf, NEEDLE, 0, WINDOW);
  if (at < 0) at = findBytes(buf, NEEDLE, buf.length - WINDOW, buf.length);
  if (at < 0) throw new RoflError('Não foi encontrado o bloco de metadados deste replay. O formato pode ser de uma versão que o LOL Insight ainda não reconhece.');
  const end = jsonEnd(buf, at);
  if (end < 0) throw new RoflError('O bloco de metadados do replay está incompleto.');
  let meta: { gameLength?: number; gameVersion?: string; statsJson?: string };
  try {
    meta = JSON.parse(new TextDecoder('utf-8').decode(buf.subarray(at, end)));
  } catch {
    throw new RoflError('Os metadados do replay não puderam ser lidos.');
  }
  let stats: Array<Record<string, unknown>> = [];
  try {
    stats = typeof meta.statsJson === 'string' ? JSON.parse(meta.statsJson) : [];
  } catch {
    stats = [];
  }
  const players: RoflPlayer[] = stats.map((p) => {
    const gameName = String(p.RIOT_ID_GAME_NAME ?? p.NAME ?? p.SUMMONER_NAME ?? '?');
    const tag = p.RIOT_ID_TAG_LINE ? `#${p.RIOT_ID_TAG_LINE}` : '';
    return {
      name: `${gameName}${tag}`,
      champion: String(p.SKIN ?? p.CHAMPION ?? '?'),
      team: String(p.TEAM) === '200' ? 'RED' : 'BLUE',
      win: String(p.WIN).toLowerCase() === 'win',
      kills: num(p.CHAMPIONS_KILLED),
      deaths: num(p.NUM_DEATHS),
      assists: num(p.ASSISTS),
      cs: num(p.MINIONS_KILLED) + num(p.NEUTRAL_MINIONS_KILLED),
      gold: num(p.GOLD_EARNED),
      damage: num(p.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS),
      vision: num(p.VISION_SCORE),
      position: String(p.INDIVIDUAL_POSITION ?? p.TEAM_POSITION ?? ''),
      level: num(p.LEVEL),
    };
  });
  return { gameLengthSec: Math.round(num(meta.gameLength) / 1000), gameVersion: String(meta.gameVersion ?? '?'), players, size: buf.length };
}
