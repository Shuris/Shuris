import { mean, stdDev } from '@/stats/aggregate';
import { rankToAbsolute } from '@/stats/rank';
import type { Match, RankSnapshot } from '@/types';

export interface LpEstimate {
  /** LP médios ganhos por vitória e perdidos por derrota. */
  gain: number;
  loss: number;
  gainSd: number;
  lossSd: number;
  source: 'observed' | 'default';
  samples: number;
  text: string;
}

/** Valores usados quando não há histórico suficiente: ganho e perda iguais, sem presumir vantagem. */
const DEFAULT_LP = 20;
const DEFAULT_SD = 3;
const MIN_SAMPLES = 3;
const plausible = (v: number) => v >= 8 && v <= 40;

/**
 * Estima quantos LP o jogador ganha por vitória e perde por derrota.
 *
 * A Riot não informa o MMR nem o LP de cada partida. O que existe:
 *  - na demonstração, a variação de LP registrada em cada partida;
 *  - nos dados reais, os snapshots de elo do backend: comparando dois registros
 *    consecutivos sabemos quantas vitórias e derrotas houve entre eles e quanto
 *    o LP mudou.
 * Sem observações suficientes, usa um valor padrão neutro e sinaliza a limitação.
 */
export function estimateLpPerGame(matches: Match[], snapshots: RankSnapshot[]): LpEstimate {
  const gains: number[] = [];
  const losses: number[] = [];

  for (const m of matches) {
    if (m.queue !== 'SOLO' || m.lpDelta === undefined) continue;
    if (m.lpDelta > 0) gains.push(m.lpDelta);
    else if (m.lpDelta < 0) losses.push(-m.lpDelta);
  }

  if (gains.length < MIN_SAMPLES || losses.length < MIN_SAMPLES) {
    const solo = snapshots.filter((s) => s.queue === 'SOLO').sort((a, b) => a.t - b.t);
    const mixed: Array<{ dw: number; dl: number; dlp: number }> = [];
    for (let i = 1; i < solo.length; i++) {
      const dw = solo[i].wins - solo[i - 1].wins;
      const dl = solo[i].losses - solo[i - 1].losses;
      // Contadores que diminuem indicam virada de temporada: o intervalo não é comparável.
      if (dw < 0 || dl < 0 || dw + dl === 0 || dw + dl > 15) continue;
      const dlp = rankToAbsolute(solo[i].rank) - rankToAbsolute(solo[i - 1].rank);
      if (dl === 0 && plausible(dlp / dw)) for (let k = 0; k < dw; k++) gains.push(dlp / dw);
      else if (dw === 0 && plausible(-dlp / dl)) for (let k = 0; k < dl; k++) losses.push(-dlp / dl);
      else mixed.push({ dw, dl, dlp });
    }
    // Intervalos com vitórias e derrotas: usa o lado já conhecido para isolar o outro.
    for (const it of mixed) {
      if (gains.length >= MIN_SAMPLES && losses.length < MIN_SAMPLES * 3) {
        const l = (mean(gains) * it.dw - it.dlp) / it.dl;
        if (plausible(l)) for (let k = 0; k < it.dl; k++) losses.push(l);
      } else if (losses.length >= MIN_SAMPLES && gains.length < MIN_SAMPLES * 3) {
        const g = (it.dlp + mean(losses) * it.dl) / it.dw;
        if (plausible(g)) for (let k = 0; k < it.dw; k++) gains.push(g);
      }
    }
  }

  if (gains.length >= MIN_SAMPLES && losses.length >= MIN_SAMPLES) {
    const gain = mean(gains);
    const loss = mean(losses);
    return {
      gain,
      loss,
      gainSd: Math.max(1.5, stdDev(gains)),
      lossSd: Math.max(1.5, stdDev(losses)),
      source: 'observed',
      samples: gains.length + losses.length,
      text: `Observado no histórico de LP: cerca de +${Math.round(gain)} LP por vitória e −${Math.round(loss)} LP por derrota (${gains.length + losses.length} partidas).`,
    };
  }

  return {
    gain: DEFAULT_LP,
    loss: DEFAULT_LP,
    gainSd: DEFAULT_SD,
    lossSd: DEFAULT_SD,
    source: 'default',
    samples: gains.length + losses.length,
    text: `Ainda não há histórico de LP suficiente para medir o ganho por partida. A projeção usa um valor neutro de ±${DEFAULT_LP} LP, que pode diferir do real (a Riot não informa o MMR).`,
  };
}
