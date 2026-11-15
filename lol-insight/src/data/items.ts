import type { ChampionClass, RuneSetup } from '@/types';

/** Nomes dos itens. Começa com os usados na demonstração e recebe os do Data Dragon nos dados reais. */
export const ITEM_NAMES: Record<number, string> = {
  3020: 'Sapatos do Feiticeiro',
  3158: 'Botas Ionianas da Lucidez',
  3006: 'Grevas do Berserker',
  3047: 'Passos Blindados',
  3111: 'Passos de Mercúrio',
  6655: 'Companheiro de Luden',
  3089: 'Capuz da Morte de Rabadon',
  3157: 'Ampulheta de Zhonya',
  4645: 'Chama Sombria',
  3135: 'Cajado do Vazio',
  3100: 'Perdição do Lich',
  4646: 'Ímpeto da Tempestade',
  3165: 'Morellonomicon',
  6653: 'Tormento de Liandry',
  3116: 'Cetro de Cristal de Rylai',
  3031: 'Gume do Infinito',
  6672: 'Mata-Krakens',
  3094: 'Canhão Fumegante',
  3036: 'Lembranças do Lorde Dominik',
  3072: 'Sedenta por Sangue',
  3153: 'Espada do Rei Destruído',
  3046: 'Dançarina Fantasma',
  3071: 'Cutelo Negro',
  6610: 'Céu Dividido',
  3053: 'Medidor de Sterak',
  6333: 'Dança da Morte',
  6692: 'Eclipse',
  3026: 'Anjo Guardião',
  3074: 'Hidra Voraz',
  3078: 'Força da Trindade',
  3190: 'Medalhão dos Solari de Ferro',
  3109: 'Juramento do Cavaleiro',
  3050: 'Convergência de Zeke',
  3107: 'Redenção',
  2065: 'Canção de Batalha de Shurelya',
  3504: 'Turíbulo Ardente',
  6617: 'Renovação da Pedra Lunar',
  3075: 'Armadura de Espinhos',
  3065: 'Semblante Espiritual',
  3340: 'Totem de Vigilância',
  3363: 'Alteração da Visão Longínqua',
  3364: 'Lente do Oráculo',
};

export function registerItemNames(names: Record<string, string> | undefined): void {
  if (!names) return;
  for (const [id, name] of Object.entries(names)) ITEM_NAMES[Number(id)] = name;
}

export const itemName = (id: number) => ITEM_NAMES[id] ?? `Item ${id}`;

// ---- Builds e runas do gerador demonstrativo --------------------------------

const BUILDS: Record<ChampionClass, { boots: number; core: number[]; trinket: number }> = {
  ASSASSIN: { boots: 3020, core: [6655, 4645, 3089, 3157, 3135, 3100, 4646], trinket: 3363 },
  MAGE: { boots: 3020, core: [6655, 3089, 3157, 3135, 6653, 3165, 3116], trinket: 3363 },
  MARKSMAN: { boots: 3006, core: [6672, 3031, 3094, 3036, 3072, 3046, 3153], trinket: 3363 },
  FIGHTER: { boots: 3047, core: [3071, 6610, 3053, 6333, 6692, 3078, 3026], trinket: 3364 },
  TANK: { boots: 3111, core: [3190, 3109, 3050, 3107, 3075, 3065, 2065], trinket: 3364 },
  SUPPORT: { boots: 3158, core: [6617, 3504, 3107, 2065, 3190, 3050], trinket: 3364 },
};

export function buildFor(cls: ChampionClass) {
  return BUILDS[cls];
}

const RUNES: Partial<Record<ChampionClass, RuneSetup>> & { MAGE: RuneSetup } = {
  ASSASSIN: {
    keystone: 'Eletrocutar',
    primaryTree: 'Dominação',
    primary: ['Gosto de Sangue', 'Coleção de Olhos', 'Caça Suprema'],
    secondaryTree: 'Feitiçaria',
    secondary: ['Faixa de Fluxo de Mana', 'Transcendência'],
    shards: ['Força Adaptativa', 'Força Adaptativa', 'Vida Escalável'],
  },
  MAGE: {
    keystone: 'Invocar Aery',
    primaryTree: 'Feitiçaria',
    primary: ['Faixa de Fluxo de Mana', 'Transcendência', 'Chamuscar'],
    secondaryTree: 'Inspiração',
    secondary: ['Entrega de Biscoitos', 'Perspicácia Cósmica'],
    shards: ['Aceleração de Habilidade', 'Força Adaptativa', 'Vida Escalável'],
  },
  MARKSMAN: {
    keystone: 'Ritmo Fatal',
    primaryTree: 'Precisão',
    primary: ['Presença de Espírito', 'Lenda: Linhagem', 'Golpe de Misericórdia'],
    secondaryTree: 'Inspiração',
    secondary: ['Calçados Mágicos', 'Entrega de Biscoitos'],
    shards: ['Velocidade de Ataque', 'Força Adaptativa', 'Vida Escalável'],
  },
  FIGHTER: {
    keystone: 'Conquistador',
    primaryTree: 'Precisão',
    primary: ['Triunfo', 'Lenda: Espontaneidade', 'Até a Morte'],
    secondaryTree: 'Determinação',
    secondary: ['Ventos Revigorantes', 'Crescimento Excessivo'],
    shards: ['Velocidade de Ataque', 'Força Adaptativa', 'Vida Escalável'],
  },
  TANK: {
    keystone: 'Pós-choque',
    primaryTree: 'Determinação',
    primary: ['Demolir', 'Osso Revestido', 'Crescimento Excessivo'],
    secondaryTree: 'Inspiração',
    secondary: ['Calçados Mágicos', 'Perspicácia Cósmica'],
    shards: ['Aceleração de Habilidade', 'Vida Escalável', 'Vida Escalável'],
  },
};

export function runesFor(cls: ChampionClass): RuneSetup {
  return RUNES[cls] ?? RUNES.MAGE;
}
