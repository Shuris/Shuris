import type { CategoryId, SkillId } from './types';

export const SKILLS: Record<SkillId, { name: string; short: string; description: string }> = {
  FARM: { name: 'Farm', short: 'Farm', description: 'Renda por tropas e monstros (CS por minuto).' },
  LANE: { name: 'Segurança na rota', short: 'Rota', description: 'Sobreviver, trocar bem e não entregar abates.' },
  VISION: { name: 'Visão de mapa', short: 'Visão', description: 'Sentinelas, varredura e informação.' },
  OBJECTIVES: { name: 'Objetivos', short: 'Objetivos', description: 'Presença em dragões, Arauto e Barão.' },
  CLOSING: { name: 'Converter vantagem', short: 'Fechar', description: 'Transformar liderança em vitória.' },
  TEAMFIGHT: { name: 'Lutas em equipe', short: 'Lutas', description: 'Participação e posicionamento nas lutas.' },
  MENTAL: { name: 'Mentalidade', short: 'Mental', description: 'Regularidade e reação a derrotas.' },
  POOL: { name: 'Pool de campeões', short: 'Pool', description: 'Foco em poucos campeões que você domina.' },
};

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

export const CATEGORIES: Record<CategoryId, { name: string; description: string; icon: string }> = {
  fundamentos: { name: 'Fundamentos', description: 'A base de toda partida: farm, wave, recursos, posição e visão.', icon: 'cube-outline' },
  rotas: { name: 'Fase de rotas', description: 'Os primeiros minutos: trocas, ganks, vantagem e desvantagem.', icon: 'git-branch-outline' },
  combate: { name: 'Combate', description: 'Mecânica, posicionamento, alvos e uso de habilidades.', icon: 'flash-outline' },
  macro: { name: 'Macro game', description: 'Rotações, objetivos, pressão e como encerrar partidas.', icon: 'map-outline' },
  mentalidade: { name: 'Mentalidade competitiva', description: 'Derrotas, consistência, revisão e decisões.', icon: 'pulse-outline' },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];
export const LEVEL_LABEL = { 1: 'Básico', 2: 'Intermediário', 3: 'Avançado' } as const;
