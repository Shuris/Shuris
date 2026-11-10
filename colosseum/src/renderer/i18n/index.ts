// Idiomas do jogo (português e inglês). Todo texto visível passa por t():
// as chaves ficam em pt.ts e en.ts; o inglês é obrigado (pelo TypeScript) a ter
// todas as chaves do português, então nada fica sem tradução.
import { PT } from './pt';
import { EN } from './en';

export type Lang = 'pt' | 'en';
export type TKey = keyof typeof PT;
export const LANGS: Lang[] = ['pt', 'en'];

const DICTS: Record<Lang, Record<string, string>> = { pt: PT, en: EN };
let current: Lang = 'pt';
const listeners = new Set<(l: Lang) => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  if (l !== 'pt' && l !== 'en') return;
  if (l === current) return;
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l === 'pt' ? 'pt-BR' : 'en';
  for (const fn of listeners) fn(l);
}

export function onLangChange(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export type Params = Record<string, string | number>;

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Texto traduzido. Parâmetros entre chaves: t('x', { name: 'Marcus' }). */
export function t(key: TKey, params?: Params): string {
  return fill(DICTS[current][key] ?? (PT as Record<string, string>)[key] ?? key, params);
}

/** Igual a t(), mas aceita chaves montadas em tempo de execução (dados). */
export function tk(key: string, params?: Params, fallback?: string): string {
  const v = DICTS[current][key] ?? (PT as Record<string, string>)[key];
  return v === undefined ? (fallback ?? key) : fill(v, params);
}

export function hasKey(key: string): boolean {
  return key in PT;
}

/** Escolhe uma variante "a|b|c" de um texto (frases com várias versões). */
export function variant(text: string, pick: number): string {
  const parts = text.split('|');
  return parts[Math.abs(Math.floor(pick)) % parts.length];
}
