// Clima: cada dia é inteiro de sol, nublado ou de chuva (determinístico por gladiador e dia).
import { createRng } from './rng';
import { t } from '../../i18n';

export const RAIN_CHANCE = 0.25;
export const CLOUDY_CHANCE = 0.25;

export type DayKind = 'sun' | 'cloudy' | 'rain';

export interface DayWeather {
  kind: DayKind;
  rainy: boolean;
  /** a chuva dura o dia inteiro (0h a 24h) */
  start: number;
  end: number;
}

export function weatherOfDay(seed: number, day: number): DayWeather {
  const rng = createRng((seed ^ Math.imul(day + 1, 2654435761)) >>> 0);
  const r = rng();
  // o primeiro dia é sempre de sol
  const kind: DayKind = day <= 1 ? 'sun' : r < RAIN_CHANCE ? 'rain' : r < RAIN_CHANCE + CLOUDY_CHANCE ? 'cloudy' : 'sun';
  return { kind, rainy: kind === 'rain', start: 0, end: 24 * 60 };
}

export interface WeatherNow {
  /** 0 = céu limpo, 1 = totalmente nublado */
  cloud: number;
  /** 0 = sem chuva, 1 = chuva forte */
  rain: number;
}

/** Tempo agora: chuva o dia todo, céu fechado o dia todo ou sol. */
export function weatherAt(seed: number, day: number, _minutes: number): WeatherNow {
  const w = weatherOfDay(seed, day);
  if (w.kind === 'rain') return { cloud: 1, rain: 1 };
  if (w.kind === 'cloudy') return { cloud: 0.7, rain: 0 };
  return { cloud: 0, rain: 0 };
}

export function weatherLabel(now: WeatherNow): string | null {
  if (now.rain > 0.05) return t('weather.rain');
  if (now.cloud > 0.3) return t('weather.cloudy');
  return null;
}

// ------------------------------------------------------------------ estações
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
/** dias de cada estação */
export const SEASON_DAYS = 10;

/** Estação do dia (ciclo de 4 estações de 10 dias, começando na primavera). */
export function seasonOf(day: number): Season {
  return SEASONS[Math.floor((Math.max(1, day) - 1) / SEASON_DAYS) % SEASONS.length];
}

/** Neblina da manhã (0..1): começa ao amanhecer, mais densa até umas 8h, some até as 10h. */
export function morningFog(minutes: number, season: Season): number {
  const m = ((minutes % 1440) + 1440) % 1440;
  const f = m < 300 ? 0 : m < 360 ? (m - 300) / 60 : m < 480 ? 1 : m < 600 ? 1 - (m - 480) / 120 : 0;
  return f * (season === 'summer' ? 0.45 : season === 'autumn' || season === 'winter' ? 1 : 0.75);
}
