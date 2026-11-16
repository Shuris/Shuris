import type { Ionicons } from '@expo/vector-icons';

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Prefixos de rota que também acendem este item (ex.: /campeao/Zoe → Campeões). */
  match: string[];
  /** Atalho de teclado (tecla numérica). */
  key?: string;
  status?: 'parcial';
}

export const SECTIONS: NavItem[] = [
  { href: '/', label: 'Visão geral', icon: 'grid-outline', match: ['/insights'], key: '1' },
  { href: '/desempenho', label: 'Desempenho', icon: 'stats-chart-outline', match: [], key: '2' },
  { href: '/campeoes', label: 'Campeões', icon: 'shield-outline', match: ['/campeao'], key: '3' },
  { href: '/partidas', label: 'Partidas', icon: 'list-outline', match: ['/partida'], key: '4' },
  { href: '/academy', label: 'LOI Academy', icon: 'school-outline', match: [], key: '5' },
  { href: '/desafios', label: 'LOL Challenge', icon: 'flash-outline', match: [], key: '6' },
  { href: '/replay', label: 'Replay Challenge', icon: 'film-outline', match: [], key: '7' },
  { href: '/perfil', label: 'Perfil', icon: 'person-outline', match: [], key: '8' },
];

export const TOOLS: NavItem[] = [
  { href: '/previsao', label: 'Previsão de elo', icon: 'trending-up-outline', match: [] },
  { href: '/comparar', label: 'Comparar jogadores', icon: 'people-outline', match: [] },
  { href: '/caderno', label: 'Caderno de matchups', icon: 'book-outline', match: [] },
  { href: '/compartilhar', label: 'Cartão para compartilhar', icon: 'share-social-outline', match: [] },
];

export function isActive(item: NavItem, path: string): boolean {
  if (item.href === '/') return path === '/' || item.match.some((m) => path.startsWith(m));
  return path === item.href || path.startsWith(`${item.href}/`) || item.match.some((m) => path.startsWith(m));
}
