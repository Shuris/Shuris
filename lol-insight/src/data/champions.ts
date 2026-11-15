import type { Champion, Position } from '@/types';

/** Catálogo estático de campeões usado pelo protótipo (subconjunto do Data Dragon). */
export const CHAMPIONS: Record<string, Champion> = {
  Zoe: { id: 'Zoe', name: 'Zoe', title: 'O Aspecto do Crepúsculo', classes: ['EXPLOSAO'], positions: ['MID'], color: '#7B5BD6' },
  Ahri: { id: 'Ahri', name: 'Ahri', title: 'A Raposa de Nove Caudas', classes: ['EXPLOSAO'], positions: ['MID'], color: '#D5557F' },
  Syndra: { id: 'Syndra', name: 'Syndra', title: 'A Soberana Sombria', classes: ['CONTROLE'], positions: ['MID'], color: '#8A4FD0' },
  Orianna: { id: 'Orianna', name: 'Orianna', title: 'A Donzela Mecânica', classes: ['CONTROLE'], positions: ['MID'], color: '#4E8FC9' },
  Leblanc: { id: 'Leblanc', name: 'LeBlanc', title: 'A Farsante', classes: ['EXPLOSAO'], positions: ['MID'], color: '#A0509A' },
  Viktor: { id: 'Viktor', name: 'Viktor', title: 'O Arauto das Máquinas', classes: ['CONTROLE'], positions: ['MID'], color: '#9B6B3C' },
  LeeSin: { id: 'LeeSin', name: 'Lee Sin', title: 'O Monge Cego', classes: ['INICIACAO', 'LUTADOR'], positions: ['JUNGLE'], color: '#C2573A' },
  Vi: { id: 'Vi', name: 'Vi', title: 'A Defensora de Piltover', classes: ['INICIACAO', 'LUTADOR'], positions: ['JUNGLE'], color: '#D0508C' },
  Jinx: { id: 'Jinx', name: 'Jinx', title: 'O Gatilho Desenfreado', classes: ['ATIRADOR'], positions: ['ADC'], color: '#3F8FD8' },
  Kaisa: { id: 'Kaisa', name: "Kai'Sa", title: 'A Filha do Vazio', classes: ['ATIRADOR'], positions: ['ADC'], color: '#7A55C7' },
  Ezreal: { id: 'Ezreal', name: 'Ezreal', title: 'O Explorador Pródigo', classes: ['ATIRADOR'], positions: ['ADC'], color: '#C9A13F' },
  Thresh: { id: 'Thresh', name: 'Thresh', title: 'O Guardião das Correntes', classes: ['INICIACAO'], positions: ['SUPPORT'], color: '#2E9E7A' },
  Nautilus: { id: 'Nautilus', name: 'Nautilus', title: 'O Titã das Profundezas', classes: ['INICIACAO'], positions: ['SUPPORT'], color: '#2F7F8C' },
  Lulu: { id: 'Lulu', name: 'Lulu', title: 'A Feiticeira Feérica', classes: ['CONTROLE'], positions: ['SUPPORT'], color: '#9A62C9' },
  Jax: { id: 'Jax', name: 'Jax', title: 'O Grão-Mestre das Armas', classes: ['LUTADOR'], positions: ['TOP'], color: '#7C61C4' },
  Aatrox: { id: 'Aatrox', name: 'Aatrox', title: 'A Espada Darkin', classes: ['LUTADOR'], positions: ['TOP'], color: '#B8433F' },
  Ornn: { id: 'Ornn', name: 'Ornn', title: 'O Fogo sob a Montanha', classes: ['INICIACAO'], positions: ['TOP'], color: '#C4622D' },
  Yasuo: { id: 'Yasuo', name: 'Yasuo', title: 'O Imperdoável', classes: ['LUTADOR'], positions: ['MID'], color: '#4A86B8' },
  Akali: { id: 'Akali', name: 'Akali', title: 'A Assassina Renegada', classes: ['EXPLOSAO'], positions: ['MID'], color: '#2F9E6E' },
  Graves: { id: 'Graves', name: 'Graves', title: 'O Foragido', classes: ['LUTADOR'], positions: ['JUNGLE'], color: '#8C5A3A' },
  Viego: { id: 'Viego', name: 'Viego', title: 'O Rei Destruído', classes: ['LUTADOR'], positions: ['JUNGLE'], color: '#3E9C8F' },
};

export const CLASS_LABEL = {
  CONTROLE: 'campeões de controle',
  EXPLOSAO: 'campeões de explosão',
  INICIACAO: 'campeões de iniciação',
  ATIRADOR: 'atiradores',
  LUTADOR: 'lutadores',
} as const;

export const POSITION_LABEL: Record<Position, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'ADC',
  SUPPORT: 'Suporte',
};

export const POSITIONS: Position[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

export function champion(id: string): Champion {
  return CHAMPIONS[id] ?? { id, name: id, title: '', classes: [], positions: [], color: '#4A5568' };
}

export function championsByPosition(pos: Position): Champion[] {
  return Object.values(CHAMPIONS).filter((c) => c.positions.includes(pos));
}

/** Versão do Data Dragon usada para os ícones oficiais (CDN pública da Riot). */
export const ITEM_FALLBACK = '#1D2430';
export const DDRAGON_VERSION = '14.24.1';
export const championIconUrl = (id: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${id}.png`;
export const championSplashUrl = (id: string) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`;
export const itemIconUrl = (id: number) =>
  `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png`;
export const profileIconUrl = (id: number) =>
  `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${id}.png`;
