import type { Attributes, AttributeKey } from '../model/types';

export const ATTRIBUTE_INFO: Record<AttributeKey, { name: string; short: string; icon: string; description: string }> = {
  str: { name: 'Força', short: 'FOR', icon: 'attr_str', description: 'Aumenta o dano dos ataques físicos.' },
  vit: { name: 'Vitalidade', short: 'VIT', icon: 'attr_vit', description: 'Aumenta a vida máxima.' },
  res: { name: 'Resistência', short: 'RES', icon: 'attr_res', description: 'Reduz o dano recebido, aumenta a resistência máxima e diminui a fadiga.' },
  agi: { name: 'Agilidade', short: 'AGI', icon: 'attr_agi', description: 'Aumenta a velocidade de ataque, de movimento e a chance de esquiva.' },
  prec: { name: 'Precisão', short: 'PRE', icon: 'attr_prec', description: 'Aumenta a chance de acertar e de causar golpes críticos.' },
  tech: { name: 'Técnica', short: 'TEC', icon: 'attr_tech', description: 'Melhora a eficiência das habilidades especiais e dos bloqueios.' },
};

export const BASE_ATTRIBUTE = 5;
export const MAX_ATTRIBUTE = 99;
export const POINTS_PER_LEVEL = 3;
export const MAX_LEVEL = 30;

export function emptyAttributes(v = 0): Attributes {
  return { str: v, vit: v, res: v, agi: v, prec: v, tech: v };
}

export interface OriginDef {
  id: string;
  name: string;
  description: string;
  bonus: Partial<Attributes>;
}

export const ORIGINS: OriginDef[] = [
  { id: 'gaul', name: 'Gaulês', description: 'Guerreiro das tribos da Gália, forte e robusto.', bonus: { str: 2, vit: 1 } },
  { id: 'thracian', name: 'Trácio', description: 'Ágil combatente das montanhas da Trácia.', bonus: { agi: 2, prec: 1 } },
  { id: 'roman', name: 'Ex-legionário', description: 'Antigo soldado de Roma, disciplinado e resistente.', bonus: { res: 2, tech: 1 } },
  { id: 'greek', name: 'Grego', description: 'Treinado nos ginásios helênicos, valoriza a técnica.', bonus: { tech: 2, prec: 1 } },
];

export function getOrigin(id: string): OriginDef {
  return ORIGINS.find((o) => o.id === id) ?? ORIGINS[0];
}

/** Paletas usadas para tingir cabelo e tecido (hex numérico para Phaser). */
export const HAIR_COLORS = [0x3a2616, 0x6e4422, 0x1e1812, 0xa87a3e, 0x8a3a1e, 0x9a958c];
export const CLOTH_COLORS = [0xc8483a, 0xe8dcc0, 0x4a6aa8, 0x5a8a4a, 0xd8a440, 0x7a4a8a];
export const SKIN_NAMES = ['Clara', 'Morena', 'Escura', 'Muito clara', 'Retinta'];
export const HAIR_STYLE_NAMES = ['Curto', 'Longo', 'Raspado', 'Cacheado', 'Rabo de cavalo', 'Crista', 'Coque'];
