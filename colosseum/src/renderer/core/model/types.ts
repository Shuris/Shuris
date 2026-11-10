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
}

export interface InventoryItem {
  uid: string;
  itemId: string;
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

export type DayNightMode = 'cycle' | 'real';

export interface GameSettings {
  battleSpeed: number; // 1, 2 ou 3
  autoContinue: boolean;
  tipsSeen: string[];
  /** volume geral dos efeitos sonoros (0..1) */
  volume: number;
  muted: boolean;
  /** ciclo acelerado (10 min) ou horário real do computador */
  dayNight: DayNightMode;
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
  createdAt: number;
  updatedAt: number;
}
