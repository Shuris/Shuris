// Clima: alguns dias têm chuva durante parte do dia (determinístico por gladiador e dia).
import { createRng } from './rng';
import { t } from '../../i18n';

export const RAIN_CHANCE = 0.3;

export interface DayWeather {
  rainy: boolean;
  /** início e fim da chuva (minutos do dia) */
  start: number;
  end: number;
}

export function weatherOfDay(seed: number, day: number): DayWeather {
  const rng = createRng((seed ^ Math.imul(day + 1, 2654435761)) >>> 0);
  const rainy = day > 1 && rng() < RAIN_CHANCE;
  const start = 8 * 60 + Math.floor(rng() * 7) * 60; // entre 8h e 14h
  const end = start + (3 + Math.floor(rng() * 4)) * 60; // dura de 3 a 6 horas
  return { rainy, start, end };
}

export interface WeatherNow {
  /** 0 = céu limpo, 1 = totalmente nublado */
  cloud: number;
  /** 0 = sem chuva, 1 = chuva forte */
  rain: number;
}

/** Intensidade atual, com transição de 40 minutos no começo e no fim da chuva. */
export function weatherAt(seed: number, day: number, minutes: number): WeatherNow {
  const w = weatherOfDay(seed, day);
  if (!w.rainy) return { cloud: 0, rain: 0 };
  const ramp = 40;
  let rain = 0;
  if (minutes >= w.start && minutes <= w.end) rain = Math.min(1, (minutes - w.start) / ramp, (w.end - minutes) / ramp);
  rain = Math.max(0, rain);
  return { cloud: Math.max(0.55, rain), rain };
}

export function weatherLabel(now: WeatherNow): string | null {
  if (now.rain > 0.05) return t('weather.rain');
  if (now.cloud > 0.3) return t('weather.cloudy');
  return null;
}
