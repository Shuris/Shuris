import type { ItemDef, Rarity } from '../model/types';

// Tintas (multiplicativas) para variações de raridade usando a mesma arte.
const GOLD_TINT = 0xffe08a;
const DARK_BRONZE = 0xd8b890;
const STEEL_TINT = 0xd8e4ff;

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  epic: 'Épico',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#cfc6b4',
  uncommon: '#7cc25a',
  rare: '#5aa0f0',
  epic: '#c27ae8',
};

export const CATEGORY_LABEL = {
  weapon: 'Arma',
  shield: 'Escudo',
  helmet: 'Capacete',
  armor: 'Armadura',
  legs: 'Pernas',
} as const;

export const ITEMS: ItemDef[] = [
  // ------------------------------------------------------------- ARMAS
  {
    id: 'rudis', name: 'Rúdis de treino', category: 'weapon', slot: 'mainHand', rarity: 'common',
    description: 'Espada de madeira usada nos treinos do ludus. Leve, mas pouco letal.',
    price: 10, minLevel: 1, shop: false,
    mods: { damage: 2, reach: 22 },
    visual: { sheets: ['weapon_rudis'], icon: 'weapon_rudis' },
  },
  {
    id: 'short_sword', name: 'Espada curta', category: 'weapon', slot: 'mainHand', rarity: 'common',
    description: 'Lâmina curta e ágil. Permite golpes mais rápidos, com menos alcance.',
    price: 70, minLevel: 1, shop: true,
    mods: { damage: 4, reach: 20, attackSpeed: -0.15, attrs: { agi: 1 } },
    visual: { sheets: ['weapon_shortsword'], icon: 'weapon_shortsword' },
  },
  {
    id: 'gladius', name: 'Gládio', category: 'weapon', slot: 'mainHand', rarity: 'common',
    description: 'A espada romana clássica, feita para estocadas precisas.',
    price: 90, minLevel: 1, shop: true,
    mods: { damage: 6, reach: 24, attrs: { prec: 1 } },
    visual: { sheets: ['weapon_gladius'], icon: 'weapon_gladius' },
  },
  {
    id: 'spear', name: 'Lança', category: 'weapon', slot: 'mainHand', rarity: 'uncommon',
    description: 'Hasta de freixo com ponta de ferro. Grande alcance, golpes um pouco mais lentos.',
    price: 220, minLevel: 3, shop: true,
    mods: { damage: 7, reach: 42, attackSpeed: 0.12, attrs: { prec: 1 } },
    visual: { sheets: ['weapon_spear'], icon: 'weapon_spear' },
  },
  {
    id: 'gladius_pompeii', name: 'Gládio de Pompeia', category: 'weapon', slot: 'mainHand', rarity: 'uncommon',
    description: 'Gládio de lâmina reta e ponta triangular, forjado na Campânia.',
    price: 260, minLevel: 5, shop: true,
    mods: { damage: 9, reach: 24, attrs: { prec: 2 } },
    visual: { sheets: ['weapon_gladius'], tint: STEEL_TINT, icon: 'weapon_gladius' },
  },
  {
    id: 'trident', name: 'Tridente', category: 'weapon', slot: 'mainHand', rarity: 'rare',
    description: 'Arma do retiário. Mantém o adversário à distância e exige técnica.',
    price: 420, minLevel: 6, shop: true,
    mods: { damage: 9, reach: 40, attackSpeed: 0.15, attrs: { tech: 2 } },
    visual: { sheets: ['weapon_trident'], icon: 'weapon_trident' },
  },
  {
    id: 'sica', name: 'Sica trácia', category: 'weapon', slot: 'mainHand', rarity: 'rare',
    description: 'Lâmina curta e curva dos gladiadores trácios. Rápida e traiçoeira.',
    price: 480, minLevel: 9, shop: true,
    mods: { damage: 10, reach: 21, attackSpeed: -0.2, attrs: { agi: 2, tech: 1 } },
    visual: { sheets: ['weapon_sica'], icon: 'weapon_sica' },
  },
  {
    id: 'gladius_mainz', name: 'Gládio de Mainz', category: 'weapon', slot: 'mainHand', rarity: 'rare',
    description: 'Gládio longo e pesado, de ponta afilada. Favorece gladiadores fortes.',
    price: 520, minLevel: 10, shop: true,
    mods: { damage: 12, reach: 25, attrs: { str: 2 } },
    visual: { sheets: ['weapon_gladius'], icon: 'weapon_gladius' },
  },
  {
    id: 'hoplomachus_spear', name: 'Lança do Hoplômaco', category: 'weapon', slot: 'mainHand', rarity: 'rare',
    description: 'Lança de guerra balanceada, herança dos hoplitas gregos.',
    price: 560, minLevel: 12, shop: true,
    mods: { damage: 12, reach: 44, attackSpeed: 0.1, attrs: { prec: 2 } },
    visual: { sheets: ['weapon_spear'], tint: DARK_BRONZE, icon: 'weapon_spear' },
  },
  {
    id: 'champion_gladius', name: 'Gládio do Campeão', category: 'weapon', slot: 'mainHand', rarity: 'epic',
    description: 'Presente de um editor dos jogos a um campeão invicto. Equilíbrio perfeito.',
    price: 1400, minLevel: 15, shop: false,
    mods: { damage: 16, reach: 25, attrs: { str: 3, prec: 3 } },
    visual: { sheets: ['weapon_gladius'], tint: GOLD_TINT, icon: 'weapon_gladius' },
  },
  {
    id: 'champion_trident', name: 'Tridente do Retiário Lendário', category: 'weapon', slot: 'mainHand', rarity: 'epic',
    description: 'Tridente de bronze trabalhado, usado por um retiário celebrado em Roma.',
    price: 1450, minLevel: 15, shop: false,
    mods: { damage: 15, reach: 42, attackSpeed: 0.1, attrs: { agi: 3, tech: 3 } },
    visual: { sheets: ['weapon_trident'], tint: GOLD_TINT, icon: 'weapon_trident' },
  },
  {
    id: 'arbelas', name: 'Arbelas', category: 'weapon', slot: 'mainHand', rarity: 'rare',
    description: 'Tubo de ferro que cobre o antebraço e termina numa lâmina em meia-lua. A arma do scissor.',
    price: 420, minLevel: 8, shop: true,
    mods: { damage: 9, reach: 22, attackSpeed: -0.05, attrs: { tech: 1 } },
    visual: { sheets: ['weapon_arbelas'], icon: 'weapon_arbelas' },
  },
  // ------------------------------------------------------------- ESCUDOS
  {
    id: 'parmula', name: 'Escudo pequeno', category: 'shield', slot: 'offHand', rarity: 'common',
    description: 'Parmula de madeira com aro de bronze. Leve e fácil de manejar.',
    price: 60, minLevel: 1, shop: true,
    mods: { defense: 3, block: 0.4 },
    visual: { sheets: ['shield_parmula'], icon: 'shield_parmula' },
  },
  {
    id: 'scutum', name: 'Scutum', category: 'shield', slot: 'offHand', rarity: 'uncommon',
    description: 'Grande escudo retangular. Excelente proteção, mas reduz a mobilidade.',
    price: 240, minLevel: 3, shop: true,
    mods: { defense: 7, block: 0.6, attackSpeed: 0.08, attrs: { agi: -2 } },
    visual: { sheets: ['shield_scutum'], icon: 'shield_scutum' },
  },
  {
    id: 'thracian_parma', name: 'Parma trácia', category: 'shield', slot: 'offHand', rarity: 'rare',
    description: 'Escudo quadrado e côncavo dos trácios, equilibrando defesa e agilidade.',
    price: 450, minLevel: 8, shop: true,
    mods: { defense: 6, block: 0.5, attrs: { agi: 1, tech: 1 } },
    visual: { sheets: ['shield_parma'], icon: 'shield_parma' },
  },
  {
    id: 'reinforced_scutum', name: 'Scutum reforçado', category: 'shield', slot: 'offHand', rarity: 'rare',
    description: 'Scutum com bordas de ferro e umbo pesado.',
    price: 600, minLevel: 11, shop: true,
    mods: { defense: 11, block: 0.65, attackSpeed: 0.08, attrs: { agi: -2 } },
    visual: { sheets: ['shield_scutum'], tint: STEEL_TINT, icon: 'shield_scutum' },
  },
  {
    id: 'champion_scutum', name: 'Scutum do Campeão', category: 'shield', slot: 'offHand', rarity: 'epic',
    description: 'Escudo ornamentado com louros dourados, símbolo de muitas vitórias.',
    price: 1500, minLevel: 15, shop: false,
    mods: { defense: 14, block: 0.72, attackSpeed: 0.05, attrs: { vit: 2 } },
    visual: { sheets: ['shield_scutum'], tint: GOLD_TINT, icon: 'shield_scutum' },
  },
  {
    id: 'twin_gladius', name: 'Segundo gládio', category: 'weapon', slot: 'offHand', rarity: 'uncommon',
    description: 'Uma espada para cada mão, como os dimachaeri. Ataques mais rápidos, mas sem escudo para bloquear.',
    price: 260, minLevel: 5, shop: true,
    mods: { damage: 3, attackSpeed: -0.12, attrs: { agi: 1 } },
    visual: { sheets: ['offhand_gladius'], icon: 'offhand_gladius' },
  },
  // ------------------------------------------------------------- CAPACETES
  {
    id: 'leather_cap', name: 'Capacete de couro', category: 'helmet', slot: 'head', rarity: 'common',
    description: 'Gorro de couro endurecido. Proteção modesta.',
    price: 50, minLevel: 1, shop: true,
    mods: { defense: 2 },
    visual: { sheets: ['helmet_cap'], icon: 'helmet_cap' },
  },
  {
    id: 'galea', name: 'Capacete de gladiador', category: 'helmet', slot: 'head', rarity: 'uncommon',
    description: 'Galea de bronze com grade facial e penacho. Protege bem, mas limita a visão.',
    price: 200, minLevel: 3, shop: true,
    mods: { defense: 6, attrs: { prec: -1 } },
    visual: { sheets: ['helmet_galea'], icon: 'helmet_galea' },
  },
  {
    id: 'murmillo_helm', name: 'Galea do Mirmilão', category: 'helmet', slot: 'head', rarity: 'rare',
    description: 'Capacete pesado com crista alta, típico dos mirmilões.',
    price: 480, minLevel: 9, shop: true,
    mods: { defense: 9, attrs: { res: 1 } },
    visual: { sheets: ['helmet_murmillo'], icon: 'helmet_murmillo' },
  },
  {
    id: 'champion_helm', name: 'Galea dourada', category: 'helmet', slot: 'head', rarity: 'epic',
    description: 'Elmo cerimonial dourado, reservado aos grandes campeões da arena.',
    price: 1300, minLevel: 15, shop: false,
    mods: { defense: 12, attrs: { tech: 2 } },
    visual: { sheets: ['helmet_galea'], tint: GOLD_TINT, icon: 'helmet_galea' },
  },
  {
    id: 'provocator_helm', name: 'Elmo do Provocator', category: 'helmet', slot: 'head', rarity: 'uncommon',
    description: 'Elmo de legionário com viseira fechada e abas no pescoço, sem aba larga.',
    price: 260, minLevel: 5, shop: true,
    mods: { defense: 7 },
    visual: { sheets: ['helmet_provocator'], icon: 'helmet_provocator' },
  },
  {
    id: 'secutor_helm', name: 'Elmo do Secutor', category: 'helmet', slot: 'head', rarity: 'rare',
    description: 'Elmo liso e arredondado, com dois furos pequenos para os olhos: a rede do retiário escorrega nele.',
    price: 380, minLevel: 7, shop: true,
    mods: { defense: 8, attrs: { prec: -1, res: 1 } },
    visual: { sheets: ['helmet_secutor'], icon: 'helmet_secutor' },
  },
  {
    id: 'crupellarius_helm', name: 'Elmo fechado de Crupellarius', category: 'helmet', slot: 'head', rarity: 'rare',
    description: 'Elmo de ferro inteiriço dos crupellarii gauleses. Quase nada o atravessa, mas é pesado.',
    price: 560, minLevel: 12, shop: true,
    mods: { defense: 11, attrs: { agi: -1 } },
    visual: { sheets: ['helmet_crupellarius'], icon: 'helmet_crupellarius' },
  },
  // ------------------------------------------------------------- ARMADURAS
  {
    id: 'light_armor', name: 'Armadura leve', category: 'armor', slot: 'body', rarity: 'common',
    description: 'Peitoral de couro e linho acolchoado. Não atrapalha os movimentos.',
    price: 80, minLevel: 1, shop: true,
    mods: { defense: 5 },
    visual: { sheets: ['armor_light'], icon: 'armor_light' },
  },
  {
    id: 'medium_armor', name: 'Armadura média', category: 'armor', slot: 'body', rarity: 'uncommon',
    description: 'Lorica segmentata: faixas de ferro presas por correias de couro.',
    price: 260, minLevel: 4, shop: true,
    mods: { defense: 10, attrs: { agi: -1 } },
    visual: { sheets: ['armor_medium'], icon: 'armor_medium' },
  },
  {
    id: 'bronze_cuirass', name: 'Peitoral de bronze', category: 'armor', slot: 'body', rarity: 'rare',
    description: 'Couraça anatômica de bronze martelado.',
    price: 560, minLevel: 10, shop: true,
    mods: { defense: 14, attrs: { agi: -1, vit: 1 } },
    visual: { sheets: ['armor_heavy'], icon: 'armor_heavy' },
  },
  {
    id: 'champion_cuirass', name: 'Couraça do Campeão', category: 'armor', slot: 'body', rarity: 'epic',
    description: 'Couraça dourada com relevos de vitória.',
    price: 1600, minLevel: 15, shop: false,
    mods: { defense: 18, attrs: { vit: 3 } },
    visual: { sheets: ['armor_heavy'], tint: GOLD_TINT, icon: 'armor_heavy' },
  },
  {
    id: 'cardiophylax', name: 'Cardiophylax', category: 'armor', slot: 'body', rarity: 'uncommon',
    description: 'Placa de bronze presa ao peito por correias, a proteção típica do provocator.',
    price: 170, minLevel: 3, shop: true,
    mods: { defense: 7 },
    visual: { sheets: ['armor_cardio'], icon: 'armor_cardio' },
  },
  {
    id: 'scale_armor', name: 'Lorica squamata', category: 'armor', slot: 'body', rarity: 'rare',
    description: 'Couraça de escamas de ferro sobre couro, usada pelos crupellarii. Muito resistente e pesada.',
    price: 640, minLevel: 12, shop: true,
    mods: { defense: 16, attackSpeed: 0.08, attrs: { agi: -2 } },
    visual: { sheets: ['armor_scale'], icon: 'armor_scale' },
  },
  // ------------------------------------------------------------- PERNAS
  {
    id: 'greaves', name: 'Proteção de pernas', category: 'legs', slot: 'legs', rarity: 'common',
    description: 'Caneleiras de ferro presas com tiras de couro.',
    price: 60, minLevel: 1, shop: true,
    mods: { defense: 3 },
    visual: { sheets: ['legsb_iron', 'legsf_iron'], icon: 'legs_iron' },
  },
  {
    id: 'bronze_greaves', name: 'Grevas de bronze', category: 'legs', slot: 'legs', rarity: 'uncommon',
    description: 'Ocreae de bronze com joelheiras.',
    price: 210, minLevel: 4, shop: true,
    mods: { defense: 6 },
    visual: { sheets: ['legsb_bronze', 'legsf_bronze'], icon: 'legs_bronze' },
  },
  {
    id: 'ornate_greaves', name: 'Ocreae ornamentadas', category: 'legs', slot: 'legs', rarity: 'rare',
    description: 'Grevas altas decoradas, leves e resistentes.',
    price: 450, minLevel: 9, shop: true,
    mods: { defense: 8, attrs: { agi: 1 } },
    visual: { sheets: ['legsb_bronze', 'legsf_bronze'], tint: DARK_BRONZE, icon: 'legs_bronze' },
  },
  {
    id: 'champion_greaves', name: 'Grevas do Campeão', category: 'legs', slot: 'legs', rarity: 'epic',
    description: 'Grevas douradas que acompanham a armadura do campeão.',
    price: 1200, minLevel: 15, shop: false,
    mods: { defense: 10, attrs: { agi: 2, res: 1 } },
    visual: { sheets: ['legsb_bronze', 'legsf_bronze'], tint: GOLD_TINT, icon: 'legs_bronze' },
  },
];

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): ItemDef | undefined {
  return BY_ID.get(id);
}

export function requireItem(id: string): ItemDef {
  const it = BY_ID.get(id);
  if (!it) throw new Error(`Item desconhecido: ${id}`);
  return it;
}

export function sellPrice(item: ItemDef, plus = 0): number {
  return Math.max(1, Math.floor(item.price * 0.4 + forgeSpent(item, plus) * 0.3));
}

// ------------------------------------------------------------- FERREIRO
export const MAX_PLUS = 3;

/** Preço para levar o item de `plus` para `plus + 1`. */
export function forgeCost(item: ItemDef, plus: number): number {
  return Math.round(20 + item.price * [0.4, 0.7, 1.1][Math.max(0, Math.min(2, plus))]);
}

/** Nível mínimo do gladiador para a próxima melhoria. */
export function forgeLevel(item: ItemDef, plus: number): number {
  return item.minLevel + (plus + 1) * 3 - 2;
}

function forgeSpent(item: ItemDef, plus: number): number {
  let s = 0;
  for (let i = 0; i < plus; i++) s += forgeCost(item, i);
  return s;
}

/** Item com as melhorias do ferreiro aplicadas (cópia; o original não muda). */
export function forged(item: ItemDef, plus = 0): ItemDef {
  const n = Math.max(0, Math.min(MAX_PLUS, Math.floor(plus)));
  if (!n) return item;
  const m = { ...item.mods };
  if (item.category === 'weapon') m.damage = (m.damage ?? 0) + n * Math.max(1, Math.round((item.mods.damage ?? 0) * 0.15));
  if (m.block) m.block = Math.min(0.85, m.block + 0.02 * n);
  if (item.category !== 'weapon') m.defense = (m.defense ?? 0) + n * Math.max(1, Math.ceil((item.mods.defense ?? 0) * 0.15));
  return { ...item, mods: m, plus: n };
}

/** Item do inventário com as melhorias do ferreiro. */
export function invItem(inv: { itemId: string; plus?: number } | undefined): ItemDef | undefined {
  const def = inv ? BY_ID.get(inv.itemId) : undefined;
  return def ? forged(def, inv?.plus ?? 0) : undefined;
}
