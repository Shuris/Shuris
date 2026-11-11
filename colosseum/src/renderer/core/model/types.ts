// Tipos centrais do domínio do jogo (sem dependência de Phaser ou DOM).

export const ATTRIBUTE_KEYS = ['str', 'vit', 'res', 'agi', 'prec', 'tech'] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;

export const SLOTS = ['mainHand', 'offHand', 'head', 'body', 'legs'] as const;
export type Slot = (typeof SLOTS)[number];

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';
export type ItemCategory = 'weapon' | 'shield' | 'helmet' | 'armor' | 'legs';

export interface ItemMods {
  damage?: number;
  defense?: number;
  /** segundos somados ao intervalo de ataque (negativo = mais rápido) */
  attackSpeed?: number;
  /** alcance da arma em pixels do mundo */
  reach?: number;
  /** fração do dano absorvida ao bloquear (escudos) */
  block?: number;
  attrs?: Partial<Attributes>;
}

/** Visual do item: folha(s) de sprite a empilhar + tinta opcional. */
export interface ItemVisual {
  sheets: string[];
  tint?: number;
  icon: string;
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  slot: Slot;
  rarity: Rarity;
  price: number;
  minLevel: number;
  /** disponível no mercado */
  shop: boolean;
  mods: ItemMods;
  visual: ItemVisual;
  /** melhorias do ferreiro já aplicadas (cópias criadas por forged()) */
  plus?: number;
}

export interface InventoryItem {
  uid: string;
  itemId: string;
  /** melhorias do ferreiro (+1 a +3) */
  plus?: number;
}

export type StrategyId = 'aggressive' | 'balanced' | 'defensive';
export type SkillId = 'power_strike' | 'iron_guard' | 'quick_strike' | 'counter';
export type TrainingId = 'str' | 'res' | 'agi' | 'tech';

export interface Appearance {
  skin: number; // 0..2
  hairStyle: number; // 0..2
  hairColor: number; // índice da paleta
  beard: boolean;
  clothColor: number; // índice da paleta
}

export interface TrainingProgress {
  progress: number; // 0..99
  sessions: number;
}

export interface BattleRecord {
  id: string;
  date: number;
  opponentId: string;
  opponentName: string;
  opponentLevel: number;
  playerLevel: number;
  result: 'win' | 'loss';
  reason: 'ko' | 'decision' | 'forfeit';
  duration: number;
  strategy: StrategyId;
  xp: number;
  coins: number;
  reputation: number;
  itemId: string | null;
  levelUps: number;
}

export type LocationId = 'ludus' | 'home' | 'market' | 'arena' | 'temple' | 'forum' | 'baths' | 'tavern';

/** Tipo de luta: escada de adversários, desafiante avulso, revanche ou torneio. */
export type FightMode = 'ladder' | 'free' | 'rematch' | 'tournament' | 'beast' | 'invite' | 'duo';

export interface NewsItem {
  id: string;
  kind: 'fame' | 'victory' | 'defeat' | 'streak' | 'level' | 'arena' | 'rival' | 'champion' | 'debut' | 'city' | 'event' | 'tournament';
  headline: string;
  body: string;
  /** modelo de texto (traduzível): news.<tpl>.h / .b */
  tpl?: string;
  /** variáveis do modelo (ids: nome, origem, rival, adversário, arena) */
  v?: Record<string, string | number>;
  /** ilustração em preto e branco (assets/news/<img>.png) */
  img?: string;
}

export interface Edition {
  day: number;
  items: NewsItem[];
  read: boolean;
}

export interface NewsState {
  editions: Edition[];
  /** notícias que sairão na próxima edição (manhã seguinte) */
  pending: NewsItem[];
  /** marcos já noticiados (fama, níveis, sequências) */
  milestones: string[];
}

export interface GameSettings {
  battleSpeed: number; // 1, 2 ou 3
  autoContinue: boolean;
  tipsSeen: string[];
  /** volume geral dos efeitos sonoros (0..1) */
  volume: number;
  muted: boolean;
  /** idioma da interface */
  language: 'pt' | 'en';
}

/** Lembrança de um adversário da escada (rivais reagem ao jogador). */
export interface RivalMemory {
  wins: number;
  losses: number;
  lastDay: number;
  /** resultado da última luta, do ponto de vista do jogador */
  last: 'win' | 'loss';
}

/** Pedido de revanche de um adversário derrotado (ele treina enquanto espera). */
export interface RematchRequest {
  opponentId: string;
  /** dia em que o pedido foi feito (sai no jornal da manhã seguinte) */
  askedDay: number;
  /** último dia para aceitar */
  expires: number;
}

/** Torneio em andamento (chave de 8 lutadores). */
export interface TournamentRun {
  day: number;
  /** ids dos lutadores na ordem da chave ('player' = o jogador) */
  bracket: string[];
  /** níveis dos lutadores (mesma ordem) */
  levels: number[];
  /** vencedores já decididos: 4 das quartas, 2 das semis e 1 da final (índices da chave) */
  winners: number[];
  /** jogador eliminado (ou campeão) */
  done: boolean;
}

export interface TournamentState {
  /** sábado em que o jogador está inscrito (0 = nenhum) */
  registered: number;
  run: TournamentRun | null;
  titles: number;
  /** melhor rodada já alcançada (0 = quartas, 3 = campeão) */
  best: number;
}

export interface EventsState {
  /** último domingo em que disputou a queda de braço */
  armDay: number;
  armWins: number;
  /** compras feitas na visita atual do mercador */
  merchantDay: number;
  merchantBought: string[];
  /** lutas avulsas do dia (cada uma contra um desafiante novo) */
  freeDay: number;
  freeCount: number;
}

/** Convite de uma arena particular (por fama). */
export interface InviteState {
  id: string;
  status: 'open' | 'done';
  /** dia em que chegou */
  day: number;
  won: boolean;
  /** torneio por convite: rodada atual (0 = semifinal, 1 = final) e adversários sorteados */
  round: number;
  foes: Array<{ id: string; level: number }>;
}

/** Missão curta de um morador. */
export interface QuestState {
  id: string;
  npc: string;
  kind: 'beat' | 'wins' | 'deliver' | 'offering' | 'train';
  /** adversário (beat) ou item (deliver) */
  target: string;
  need: number;
  progress: number;
  day: number;
  expires: number;
  reward: { coins: number; fame: number; item: string | null };
}

/** Linha do ranking da cidade (os outros gladiadores; o jogador é calculado). */
export interface RankEntry {
  id: string;
  level: number;
  pts: number;
  w: number;
  l: number;
  /** posição no dia anterior (0 = nova) */
  prev: number;
}

/** Versão 5: convites, amizades e duplas, missões, ranking, venatio e plateia. */
export interface CareerState {
  invites: InviteState[];
  /** respeito dos adversários derrotados (0..100); a partir de FRIEND_RESPECT é amigo */
  respect: Record<string, number>;
  /** parceiro escolhido para as lutas de dupla */
  partner: string | null;
  quest: QuestState | null;
  questsDone: number;
  /** último dia em que uma missão terminou ou foi oferecida */
  questDay: number;
  rank: RankEntry[];
  rankDay: number;
  /** pontos do jogador no ranking e posição de ontem */
  rankPts: number;
  rankPrev: number;
  /** (antigo) último dia de conversa com um rival; mantido por compatibilidade */
  talkDay: number;
  /** último dia em que conversou com cada rival pela cidade (um clique por dia em cada um) */
  chatDays: Record<string, number>;
  /** último dia em que enfrentou uma fera */
  beastDay: number;
  beastWins: number;
  duoWins: number;
  /** último dia de luta em dupla */
  duoDay: number;
  /** melhor favor da plateia (polegar para cima) */
  thumbsUp: number;
}

export interface PlayerState {
  version: number;
  name: string;
  origin: string;
  appearance: Appearance;
  level: number;
  xp: number;
  coins: number;
  reputation: number;
  baseAttributes: Attributes;
  trainedBonus: Attributes;
  unspentPoints: number;
  training: Record<TrainingId, TrainingProgress>;
  equipment: Record<Slot, string | null>; // uid do item equipado
  inventory: InventoryItem[];
  history: BattleRecord[];
  stats: { wins: number; losses: number; battles: number };
  strategy: StrategyId;
  defeatedOpponents: string[];
  selectedOpponent: string;
  settings: GameSettings;
  nextUid: number;
  /** calendário: dia atual (começa em 1) e minutos desde a meia-noite */
  day: number;
  minutes: number;
  /** energia do gladiador (0..100): treinar e lutar cansam; dormir recupera */
  energy: number;
  location: LocationId;
  /** árvore de habilidades */
  skillPoints: number;
  perks: string[];
  respecs: number;
  /** sequência atual: positiva = vitórias seguidas, negativa = derrotas seguidas */
  streak: number;
  news: NewsState;
  /** melhorias compradas (cama, equipamentos do ludus...) */
  upgrades: string[];
  /** taverna: último dia em que ouviu boatos e conversas já ouvidas */
  tavern: { rumorDay: number; heard: string[] };
  /** versão 4: rivais, revanche, ferimentos, torneio e eventos da cidade */
  rivals: Record<string, RivalMemory>;
  rematch: RematchRequest | null;
  /** dia do último pedido de revanche (evita pedidos frequentes) */
  lastRematchDay: number;
  /** ferimento: dias restantes até sarar (ou null) */
  injury: { days: number } | null;
  tournament: TournamentState;
  events: EventsState;
  career: CareerState;
  createdAt: number;
  updatedAt: number;
}
