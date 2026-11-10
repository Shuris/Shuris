// Preferência de idioma da interface (vale também antes de existir um gladiador).
import type { Lang } from './index';

const KEY = 'colosseum.lang';

export function loadLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'pt' || v === 'en') return v;
  } catch {
    /* armazenamento indisponível */
  }
  return 'pt';
}

export function saveLang(l: Lang): void {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* armazenamento indisponível */
  }
}
