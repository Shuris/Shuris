// Nomes e descrições dos dados do jogo (itens, adversários, habilidades, locais...).
// O português fica nos próprios arquivos de dados; aqui está o inglês. Um teste
// unitário garante que todo dado tem tradução.
import type { AttributeKey, ItemDef, LocationId, Rarity, SkillId, Slot, StrategyId, TrainingId } from '../core/model/types';
import type { OpponentDef } from '../core/data/opponents';
import type { PerkDef, BranchId } from '../core/data/skillTree';
import type { OriginDef } from '../core/data/gladiators';
import { getLang, tk } from './index';

type ND = { name: string; description: string };

export const EN_ITEMS: Record<string, ND> = {
  rudis: { name: 'Training rudis', description: 'Wooden sword used for practice in the ludus. Light, but hardly lethal.' },
  short_sword: { name: 'Short sword', description: 'Short, nimble blade. Faster strikes, less reach.' },
  gladius: { name: 'Gladius', description: 'The classic Roman sword, made for precise thrusts.' },
  spear: { name: 'Spear', description: 'Ash shaft with an iron head. Long reach, slightly slower strikes.' },
  gladius_pompeii: { name: 'Pompeii gladius', description: 'Straight-bladed gladius with a triangular point, forged in Campania.' },
  trident: { name: 'Trident', description: 'The retiarius weapon. Keeps rivals at a distance and demands technique.' },
  sica: { name: 'Thracian sica', description: 'Short curved blade of the Thracian gladiators. Fast and treacherous.' },
  gladius_mainz: { name: 'Mainz gladius', description: 'Long, heavy gladius with a sharp point. Suits strong fighters.' },
  hoplomachus_spear: { name: 'Hoplomachus spear', description: 'Well-balanced war spear, a legacy of the Greek hoplites.' },
  champion_gladius: { name: "Champion's gladius", description: 'A gift from a games sponsor to an undefeated champion. Perfect balance.' },
  champion_trident: { name: 'Trident of the Legendary Retiarius', description: 'Worked bronze trident used by a celebrated retiarius in Rome.' },
  parmula: { name: 'Small shield', description: 'Wooden parmula with a bronze rim. Light and easy to handle.' },
  scutum: { name: 'Scutum', description: 'Large rectangular shield. Excellent protection, but reduces mobility.' },
  thracian_parma: { name: 'Thracian parma', description: 'Square, concave Thracian shield that balances defense and agility.' },
  reinforced_scutum: { name: 'Reinforced scutum', description: 'Scutum with iron edges and a heavy boss.' },
  champion_scutum: { name: "Champion's scutum", description: 'Shield adorned with golden laurels, a symbol of many victories.' },
  leather_cap: { name: 'Leather cap', description: 'Hardened leather cap. Modest protection.' },
  galea: { name: 'Gladiator helmet', description: 'Bronze galea with a face grille and plume. Good protection, limited vision.' },
  murmillo_helm: { name: 'Murmillo galea', description: 'Heavy helmet with a tall crest, typical of the murmillones.' },
  champion_helm: { name: 'Golden galea', description: 'Ceremonial golden helmet, reserved for the great arena champions.' },
  light_armor: { name: 'Light armor', description: 'Leather and padded linen breastplate. Does not hinder movement.' },
  medium_armor: { name: 'Medium armor', description: 'Lorica segmentata: iron bands held together by leather straps.' },
  bronze_cuirass: { name: 'Bronze breastplate', description: 'Anatomical cuirass of hammered bronze.' },
  champion_cuirass: { name: "Champion's cuirass", description: 'Golden cuirass with victory reliefs.' },
  greaves: { name: 'Leg guards', description: 'Iron shin guards tied with leather straps.' },
  bronze_greaves: { name: 'Bronze greaves', description: 'Bronze ocreae with knee guards.' },
  ornate_greaves: { name: 'Ornate ocreae', description: 'Tall decorated greaves, light and tough.' },
  champion_greaves: { name: "Champion's greaves", description: "Golden greaves that match the champion's armor." },
  arbelas: { name: 'Arbelas', description: 'An iron tube covering the forearm that ends in a crescent blade. The scissor’s weapon.' },
  twin_gladius: { name: 'Second gladius', description: 'One sword for each hand, like the dimachaeri. Faster attacks, but no shield to block.' },
  provocator_helm: { name: 'Provocator helmet', description: 'Legionary helmet with a closed visor and neck flaps, without a wide brim.' },
  secutor_helm: { name: 'Secutor helmet', description: 'Smooth, rounded helmet with two small eye holes: the retiarius’ net slides off it.' },
  crupellarius_helm: { name: 'Closed crupellarius helmet', description: 'One-piece iron helmet of the Gallic crupellarii. Almost nothing gets through, but it is heavy.' },
  cardiophylax: { name: 'Cardiophylax', description: 'Bronze plate strapped to the chest, the typical protection of the provocator.' },
  scale_armor: { name: 'Lorica squamata', description: 'Iron scales over leather, worn by the crupellarii. Very tough and heavy.' },
};

export const EN_OPPONENTS: Record<string, { epithet: string; description: string }> = {
  marcus: { epithet: 'the Rookie', description: 'A recruit fresh to the ludus. Fights with a wooden rudis and little experience.' },
  cassius: { epithet: 'the Andabata', description: 'A reckless fighter who never stops attacking. Fast, but careless on defense.' },
  rufus: { epithet: 'the Retiarius', description: 'A nimble retiarius who uses the trident’s reach to keep rivals at bay.' },
  brutus: { epithet: 'the Secutor', description: 'A heavy, patient secutor protected by a large scutum.' },
  spiculus: { epithet: 'the Hoplomachus', description: 'A precise hoplomachus, famous for long-range spear thrusts.' },
  crixus: { epithet: 'the Gaul', description: 'A Gallic giant of brutal strength. Likes to end fights quickly.' },
  verus: { epithet: 'the Thracian', description: 'A fast, technical Thracian veteran who punishes every mistake with counters.' },
  priscus: { epithet: 'the Murmillo', description: 'A murmillo with an almost impenetrable guard. Waits for rivals to tire before striking.' },
  flamma: { epithet: 'the Champion', description: 'The champion of Rome, undefeated for years. Masters every technique of the arena.' },
};

export const EN_SKILLS: Record<SkillId, { name: string; description: string; trigger: string }> = {
  power_strike: {
    name: 'Power strike',
    description: 'A blow loaded with body weight. Deals much more damage and costs more stamina. Technique increases the damage.',
    trigger: 'Used when there is stamina to spare (above 45%).',
  },
  iron_guard: {
    name: 'Iron guard',
    description: 'Closes the guard and reduces damage taken for a few seconds. Technique increases the reduction and duration.',
    trigger: 'Used when health drops below 65% and the rival is close.',
  },
  quick_strike: {
    name: 'Quick strike',
    description: 'A fast thrust with short windup and recovery. Slightly less damage.',
    trigger: 'Used when the rival is recovering from a blow, stunned or exhausted.',
  },
  counter: {
    name: 'Counterattack',
    description: 'After a block or dodge, strikes back at once with extra damage. Cannot be blocked or dodged.',
    trigger: 'Chance after a successful block or dodge (higher with Technique).',
  },
};

export const EN_STRATEGIES: Record<StrategyId, ND> = {
  aggressive: { name: 'Aggressive', description: 'Constant attacks and pressure. Strikes more often and harder, but burns more stamina and defends little.' },
  balanced: { name: 'Balanced', description: 'Splits the effort between attack and defense.' },
  defensive: { name: 'Defensive', description: 'Blocks and dodges, waiting for the rival to make a mistake. Attacks less, defends better.' },
};

export const EN_ATTRIBUTES: Record<AttributeKey, { name: string; short: string; description: string }> = {
  str: { name: 'Strength', short: 'STR', description: 'Increases the damage of physical attacks.' },
  vit: { name: 'Vitality', short: 'VIT', description: 'Increases maximum health.' },
  res: { name: 'Endurance', short: 'END', description: 'Reduces damage taken, raises maximum stamina and lowers fatigue.' },
  agi: { name: 'Agility', short: 'AGI', description: 'Increases attack speed, movement speed and dodge chance.' },
  prec: { name: 'Precision', short: 'PRE', description: 'Increases hit chance and critical hits.' },
  tech: { name: 'Technique', short: 'TEC', description: 'Improves special skills and blocking.' },
};

export const EN_ORIGINS: Record<string, ND> = {
  gaul: { name: 'Gaul', description: 'A warrior of the Gallic tribes, strong and sturdy.' },
  thracian: { name: 'Thracian', description: 'A nimble fighter from the mountains of Thrace.' },
  roman: { name: 'Ex-legionary', description: 'A former soldier of Rome, disciplined and tough.' },
  greek: { name: 'Greek', description: 'Trained in the Hellenic gymnasia, values technique.' },
};

export const EN_PERKS: Record<string, { name: string; short: string }> = {
  m1: { name: 'Strong arm', short: '+5% damage' },
  m2: { name: 'Power strike', short: 'Skill: very strong blow' },
  m3a: { name: 'Fury', short: '+4% critical' },
  m3b: { name: 'Heavy blow', short: 'Power strike +25%' },
  m4: { name: 'Guard breaker', short: 'Ignores 12% of blocks' },
  m5: { name: 'Wrath of Mars', short: '+8% damage, +4% critical' },
  v1: { name: 'Light feet', short: '+4% dodge' },
  v2: { name: 'Quick strike', short: 'Skill: fast blow' },
  v3a: { name: 'Rhythm', short: 'Attacks 8% faster' },
  v3b: { name: 'Eagle eyes', short: '+6% hit chance' },
  v4: { name: 'Counterattack', short: 'Skill: strikes back after defending' },
  v5: { name: 'Wings of Mercury', short: '+5% dodge, 8% faster' },
  d1: { name: 'Thick skin', short: '+6% health' },
  d2: { name: 'Iron guard', short: 'Skill: reduces damage' },
  d3a: { name: 'Iron lungs', short: '+25% stamina recovery' },
  d3b: { name: 'Bulwark', short: '+6% block' },
  d4: { name: 'Second wind', short: 'Heals once per fight' },
  d5: { name: 'Shield of Minerva', short: '−8% damage taken, +8% health' },
};

export const EN_BRANCHES: Record<BranchId, { name: string; subtitle: string }> = {
  mars: { name: 'Mars', subtitle: 'Attack' },
  mercury: { name: 'Mercury', subtitle: 'Speed' },
  minerva: { name: 'Minerva', subtitle: 'Defense' },
};

export const EN_LOCATIONS: Record<LocationId, { name: string; short: string }> = {
  home: { name: 'Lodging', short: 'Sleep and rest' },
  ludus: { name: 'Ludus', short: 'Train' },
  market: { name: 'Market', short: 'Buy and sell' },
  arena: { name: 'Arena', short: 'Fight' },
  temple: { name: 'Temple of Mars', short: 'Skill tree' },
  forum: { name: 'Forum', short: 'Newspaper (Capua Times)' },
  baths: { name: 'Baths', short: 'Recover energy' },
  tavern: { name: 'Tavern', short: 'Food, wine and rumors' },
};

export const EN_ARENAS: Record<string, string> = {
  capua: 'Arena of Capua',
  pompeii: 'Amphitheater of Pompeii',
  verona: 'Arena of Verona',
  leptis: 'Amphitheater of Leptis Magna',
  rome: 'Colosseum of Rome',
  villa: 'Arena of the Villa of Lucullus',
  senator: 'Amphitheater of Senator Varro',
  baiae: 'Golden Arena of Baiae',
};

export const EN_TRAININGS: Record<TrainingId, ND> = {
  str: { name: 'Strength training', description: 'Repeated blows on the palus with stone weights.' },
  res: { name: 'Endurance training', description: 'Running in the sand carrying the scutum under the sun.' },
  agi: { name: 'Agility training', description: 'Dodges and jumps over stakes and ropes.' },
  tech: { name: 'Technique training', description: 'Fencing drills with the ludus instructor.' },
};

export const EN_RARITY: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic' };
export const EN_SLOTS: Record<Slot, string> = { mainHand: 'Weapon', offHand: 'Shield', head: 'Helmet', body: 'Armor', legs: 'Legs' };
export const EN_SKIN = ['Fair', 'Tan', 'Dark'];
export const EN_HAIR = ['Short', 'Long', 'Shaved'];

const en = () => getLang() === 'en';

export function itemName(item: ItemDef): string {
  return (en() && EN_ITEMS[item.id]?.name) || item.name;
}
export function itemDesc(item: ItemDef): string {
  return (en() && EN_ITEMS[item.id]?.description) || item.description;
}
export function opponentEpithet(o: OpponentDef): string {
  if (o.beast) return tk(`beast.${o.beast}.ep`);
  if (o.cls) return tk(`class.${o.cls}.ep`);
  return (en() && EN_OPPONENTS[o.id]?.epithet) || o.epithet;
}
export function opponentFullName(o: OpponentDef): string {
  if (o.beast) return `${tk(`beast.${o.beast}.name`)}, ${opponentEpithet(o)}`;
  return `${o.name}, ${opponentEpithet(o)}`;
}
export function opponentDesc(o: OpponentDef): string {
  if (o.beast) return tk(`beast.${o.beast}.desc`);
  if (o.cls) return tk(`class.${o.cls}.desc`);
  return (en() && EN_OPPONENTS[o.id]?.description) || o.description;
}
export function perkName(p: PerkDef): string {
  return (en() && EN_PERKS[p.id]?.name) || p.name;
}
export function perkShort(p: PerkDef): string {
  return (en() && EN_PERKS[p.id]?.short) || p.short;
}
export function originName(o: OriginDef): string {
  return (en() && EN_ORIGINS[o.id]?.name) || o.name;
}
export function originDesc(o: OriginDef): string {
  return (en() && EN_ORIGINS[o.id]?.description) || o.description;
}

// ---- dados cujo português vem dos módulos de dados
import { SKILLS, STRATEGIES } from '../core/data/skills';
import { ATTRIBUTE_INFO, HAIR_STYLE_NAMES, SKIN_NAMES } from '../core/data/gladiators';
import { BRANCHES } from '../core/data/skillTree';
import { getLocation } from '../core/data/locations';
import { getArena, type ArenaDef } from '../core/data/arenas';
import { RARITY_LABEL } from '../core/data/equipment';
import { TRAININGS } from '../core/systems/TrainingSystem';

const PT_SLOTS: Record<Slot, string> = { mainHand: 'Arma', offHand: 'Escudo', head: 'Capacete', body: 'Armadura', legs: 'Pernas' };

export const skillName = (id: SkillId) => (en() ? EN_SKILLS[id].name : SKILLS[id].name);
export const skillDesc = (id: SkillId) => (en() ? EN_SKILLS[id].description : SKILLS[id].description);
export const skillTrigger = (id: SkillId) => (en() ? EN_SKILLS[id].trigger : SKILLS[id].trigger);
export const strategyName = (id: StrategyId) => (en() ? EN_STRATEGIES[id].name : STRATEGIES[id].name);
export const strategyDesc = (id: StrategyId) => (en() ? EN_STRATEGIES[id].description : STRATEGIES[id].description);
export const attrName = (k: AttributeKey) => (en() ? EN_ATTRIBUTES[k].name : ATTRIBUTE_INFO[k].name);
export const attrShort = (k: AttributeKey) => (en() ? EN_ATTRIBUTES[k].short : ATTRIBUTE_INFO[k].short);
export const attrDesc = (k: AttributeKey) => (en() ? EN_ATTRIBUTES[k].description : ATTRIBUTE_INFO[k].description);
export const branchName = (b: BranchId) => (en() ? EN_BRANCHES[b].name : BRANCHES[b].name);
export const branchSubtitle = (b: BranchId) => (en() ? EN_BRANCHES[b].subtitle : BRANCHES[b].subtitle);
export const locationName = (id: LocationId) => (en() ? EN_LOCATIONS[id].name : getLocation(id).name);
export const locationShort = (id: LocationId) => (en() ? EN_LOCATIONS[id].short : getLocation(id).short);
export const arenaName = (a: ArenaDef | string) => {
  const def = typeof a === 'string' ? getArena(a) : a;
  if (!def) return String(a);
  return en() ? (EN_ARENAS[def.id] ?? def.name) : def.name;
};
export const trainingName = (id: TrainingId) => (en() ? EN_TRAININGS[id].name : (TRAININGS.find((x) => x.id === id)?.name ?? id));
export const trainingDesc = (id: TrainingId) => (en() ? EN_TRAININGS[id].description : (TRAININGS.find((x) => x.id === id)?.description ?? ''));
export const rarityLabel = (r: Rarity) => (en() ? EN_RARITY[r] : RARITY_LABEL[r]);
export const slotLabel = (s: Slot) => (en() ? EN_SLOTS[s] : PT_SLOTS[s]);
export const skinName = (i: number) => (en() ? EN_SKIN[i] : SKIN_NAMES[i]) ?? '';
export const hairName = (i: number) => (en() ? EN_HAIR[i] : HAIR_STYLE_NAMES[i]) ?? '';
