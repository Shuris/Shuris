import type { Champion, ChampionClass, Position } from '@/types';

/** Catálogo estático usado pelo modo demonstração (subconjunto do Data Dragon). */
export const CHAMPIONS: Record<string, Champion> = {
  Zoe: { id: 'Zoe', name: 'Zoe', title: 'O Aspecto do Crepúsculo', classes: ['MAGE'], positions: ['MID'], color: '#7B5BD6' },
  Ahri: { id: 'Ahri', name: 'Ahri', title: 'A Raposa de Nove Caudas', classes: ['MAGE', 'ASSASSIN'], positions: ['MID'], color: '#D5557F' },
  Syndra: { id: 'Syndra', name: 'Syndra', title: 'A Soberana Sombria', classes: ['MAGE'], positions: ['MID'], color: '#8A4FD0' },
  Orianna: { id: 'Orianna', name: 'Orianna', title: 'A Donzela Mecânica', classes: ['MAGE'], positions: ['MID'], color: '#4E8FC9' },
  Leblanc: { id: 'Leblanc', name: 'LeBlanc', title: 'A Farsante', classes: ['ASSASSIN', 'MAGE'], positions: ['MID'], color: '#A0509A' },
  Viktor: { id: 'Viktor', name: 'Viktor', title: 'O Arauto das Máquinas', classes: ['MAGE'], positions: ['MID'], color: '#9B6B3C' },
  LeeSin: { id: 'LeeSin', name: 'Lee Sin', title: 'O Monge Cego', classes: ['FIGHTER', 'ASSASSIN'], positions: ['JUNGLE'], color: '#C2573A' },
  Vi: { id: 'Vi', name: 'Vi', title: 'A Defensora de Piltover', classes: ['FIGHTER', 'ASSASSIN'], positions: ['JUNGLE'], color: '#D0508C' },
  Jinx: { id: 'Jinx', name: 'Jinx', title: 'O Gatilho Desenfreado', classes: ['MARKSMAN'], positions: ['ADC'], color: '#3F8FD8' },
  Kaisa: { id: 'Kaisa', name: "Kai'Sa", title: 'A Filha do Vazio', classes: ['MARKSMAN'], positions: ['ADC'], color: '#7A55C7' },
  Ezreal: { id: 'Ezreal', name: 'Ezreal', title: 'O Explorador Pródigo', classes: ['MARKSMAN', 'MAGE'], positions: ['ADC'], color: '#C9A13F' },
  Thresh: { id: 'Thresh', name: 'Thresh', title: 'O Guardião das Correntes', classes: ['TANK', 'SUPPORT'], positions: ['SUPPORT'], color: '#2E9E7A' },
  Nautilus: { id: 'Nautilus', name: 'Nautilus', title: 'O Titã das Profundezas', classes: ['TANK', 'SUPPORT'], positions: ['SUPPORT'], color: '#2F7F8C' },
  Lulu: { id: 'Lulu', name: 'Lulu', title: 'A Feiticeira Feérica', classes: ['SUPPORT', 'MAGE'], positions: ['SUPPORT'], color: '#9A62C9' },
  Jax: { id: 'Jax', name: 'Jax', title: 'O Grão-Mestre das Armas', classes: ['FIGHTER'], positions: ['TOP'], color: '#7C61C4' },
  Aatrox: { id: 'Aatrox', name: 'Aatrox', title: 'A Espada Darkin', classes: ['FIGHTER'], positions: ['TOP'], color: '#B8433F' },
  Ornn: { id: 'Ornn', name: 'Ornn', title: 'O Fogo sob a Montanha', classes: ['TANK'], positions: ['TOP'], color: '#C4622D' },
  Yasuo: { id: 'Yasuo', name: 'Yasuo', title: 'O Imperdoável', classes: ['FIGHTER', 'ASSASSIN'], positions: ['MID'], color: '#4A86B8' },
  Akali: { id: 'Akali', name: 'Akali', title: 'A Assassina Renegada', classes: ['ASSASSIN'], positions: ['MID'], color: '#2F9E6E' },
  Graves: { id: 'Graves', name: 'Graves', title: 'O Foragido', classes: ['MARKSMAN'], positions: ['JUNGLE'], color: '#8C5A3A' },
  Viego: { id: 'Viego', name: 'Viego', title: 'O Rei Destruído', classes: ['ASSASSIN', 'FIGHTER'], positions: ['JUNGLE'], color: '#3E9C8F' },
};

export const CLASS_LABEL: Record<ChampionClass, string> = {
  MAGE: 'magos',
  ASSASSIN: 'assassinos',
  MARKSMAN: 'atiradores',
  FIGHTER: 'lutadores',
  TANK: 'tanques',
  SUPPORT: 'suportes',
};

export const POSITION_LABEL: Record<Position, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'ADC',
  SUPPORT: 'Suporte',
};

export const POSITIONS: Position[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

/**
 * Registro de campeões consultado pela interface. Começa com o catálogo
 * demonstrativo e recebe o catálogo completo do Data Dragon quando uma conta
 * real é carregada.
 */
const registry = new Map<string, Champion>(Object.entries(CHAMPIONS));

export function registerChampions(list: Champion[]): void {
  for (const c of list) registry.set(c.id, c);
}

export function champion(id: string): Champion {
  return registry.get(id) ?? { id, name: id, title: '', classes: [], color: '#3A4658' };
}

export function championsByPosition(pos: Position): Champion[] {
  return Object.values(CHAMPIONS).filter((c) => c.positions?.includes(pos));
}

/** Versão do Data Dragon usada para os ícones oficiais (CDN pública da Riot). */
export const ITEM_FALLBACK = '#1D2430';

/**
 * Data Dragon — CDN oficial de imagens da Riot. A versão começa em um valor
 * conhecido e é atualizada em tempo de execução (ver services/dataDragon.ts).
 */
const DDRAGON = 'https://ddragon.leagueoflegends.com/cdn';
let ddragonVersion = '14.24.1';

export function setDataDragonVersion(version: string | undefined | null): void {
  if (version && /^\d+\.\d+\.\d+$/.test(version)) ddragonVersion = version;
}
export const dataDragonVersion = () => ddragonVersion;

export const championIconUrl = (id: string) => `${DDRAGON}/${ddragonVersion}/img/champion/${id}.png`;
export const championSplashUrl = (id: string) => `${DDRAGON}/img/champion/splash/${id}_0.jpg`;
export const itemIconUrl = (id: number) => `${DDRAGON}/${ddragonVersion}/img/item/${id}.png`;
export const profileIconUrl = (id: number) => `${DDRAGON}/${ddragonVersion}/img/profileicon/${id}.png`;
/** `path` é o caminho relativo informado pelo Data Dragon (ex.: "perk-images/Styles/..."). */
export const runeIconUrl = (path: string) => `${DDRAGON}/img/${path}`;
export const spellIconUrl = (file: string) => `${DDRAGON}/${ddragonVersion}/img/spell/${file}`;
