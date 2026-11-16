import type { Match, Rank } from '@/types';

import { summarize } from './aggregate';
import { dec, pct } from './format';
import { computeIdentity, type TraitKey } from './identity';

/**
 * Comparação entre dois jogadores: mesmas métricas, lado a lado, e frases com
 * as maiores diferenças. O radar de identidade dos dois usa a MESMA referência
 * (o elo de quem compara), para que as notas sejam comparáveis entre si.
 */

export interface CompareSide {
  name: string;
  matches: Match[];
  rank: Rank | null;
}

export interface CompareRow {
  key: string;
  label: string;
  a: number;
  b: number;
  text: [string, string];
  /** Quem está melhor nesta métrica. */
  better: 'a' | 'b' | 'tie';
}

export interface Comparison {
  rows: CompareRow[];
  verdicts: string[];
  radar: { axes: Array<{ key: TraitKey; label: string }>; a: number[]; b: number[] } | null;
  sample: [number, number];
}

interface Metric {
  key: string;
  label: string;
  get: (ms: Match[]) => number;
  fmt: (v: number) => string;
  higherIsBetter: boolean;
  /** Frase para quando um lado está melhor: "Você farma 12% mais". */
  phrase: (who: string, rel: string) => string;
  /** Métricas em porcentagem: a diferença é em pontos percentuais. */
  absolute?: boolean;
}

const nonSupport = (ms: Match[]) => ms.filter((m) => m.position !== 'SUPPORT');

const METRICS: Metric[] = [
  { key: 'wr', label: 'Taxa de vitória', get: (ms) => summarize(ms).winRate, fmt: (x) => pct(x, 1), higherIsBetter: true, phrase: (w, r) => `${w} tem taxa de vitória ${r} maior`, absolute: true },
  { key: 'kda', label: 'KDA', get: (ms) => summarize(ms).kda, fmt: (x) => dec(x, 2), higherIsBetter: true, phrase: (w, r) => `${w} tem KDA ${r} maior` },
  { key: 'deaths', label: 'Mortes por partida', get: (ms) => summarize(ms).avgDeaths, fmt: (x) => dec(x, 1), higherIsBetter: false, phrase: (w, r) => `${w} morre ${r} menos` },
  { key: 'cs', label: 'CS/min (fora do suporte)', get: (ms) => (nonSupport(ms).length ? summarize(nonSupport(ms)).csPerMin : 0), fmt: (x) => dec(x, 1), higherIsBetter: true, phrase: (w, r) => `${w} farma ${r} mais` },
  { key: 'dpm', label: 'Dano por minuto', get: (ms) => summarize(ms).damagePerMin, fmt: (x) => dec(x, 0), higherIsBetter: true, phrase: (w, r) => `${w} causa ${r} mais dano por minuto` },
  { key: 'gpm', label: 'Ouro por minuto', get: (ms) => summarize(ms).goldPerMin, fmt: (x) => dec(x, 0), higherIsBetter: true, phrase: (w, r) => `${w} ganha ${r} mais ouro por minuto` },
  { key: 'kp', label: 'Participação em abates', get: (ms) => summarize(ms).killParticipation, fmt: (x) => pct(x), higherIsBetter: true, phrase: (w, r) => `${w} participa de ${r} a mais dos abates da equipe`, absolute: true },
  { key: 'vision', label: 'Visão por minuto', get: (ms) => summarize(ms).visionPerMin, fmt: (x) => dec(x, 2), higherIsBetter: true, phrase: (w, r) => `${w} coloca ${r} mais visão` },
];

/** Diferenças relativas abaixo disso contam como empate. */
const TIE = 0.03;

export function compareSides(a: CompareSide, b: CompareSide): Comparison {
  const rows: CompareRow[] = [];
  const diffs: Array<{ rel: number; text: string }> = [];
  for (const m of METRICS) {
    const va = a.matches.length ? m.get(a.matches) : 0;
    const vb = b.matches.length ? m.get(b.matches) : 0;
    const hi = Math.max(va, vb);
    const lo = Math.min(va, vb);
    const rel = lo > 0 ? hi / lo - 1 : hi > 0 ? 1 : 0;
    let better: CompareRow['better'] = 'tie';
    if (rel >= TIE && va !== vb) better = (va > vb) === m.higherIsBetter ? 'a' : 'b';
    rows.push({ key: m.key, label: m.label, a: va, b: vb, text: [m.fmt(va), m.fmt(vb)], better });
    if (better !== 'tie') {
      const winner = better === 'a' ? a.name : b.name;
      // Para "menos é melhor", a diferença relativa é sobre o maior valor.
      const r = m.higherIsBetter ? rel : 1 - lo / hi;
      const label = m.absolute ? `${dec((hi - lo) * 100, 1)} pontos percentuais` : pct(r);
      diffs.push({ rel: m.absolute ? (hi - lo) * 4 : r, text: `${m.phrase(winner, label)}.` });
    }
  }
  const verdicts = diffs.sort((x, y) => y.rel - x.rel).slice(0, 3).map((d) => d.text);

  const ref = a.rank ?? b.rank;
  const ia = computeIdentity(a.matches, ref);
  const ib = computeIdentity(b.matches, ref);
  const radar =
    ia.enough && ib.enough
      ? {
          axes: ia.traits.map((t) => ({ key: t.key, label: t.axis })),
          a: ia.traits.map((t) => t.score),
          b: ia.traits.map((t) => ib.traits.find((x) => x.key === t.key)!.score),
        }
      : null;
  return { rows, verdicts, radar, sample: [a.matches.length, b.matches.length] };
}
