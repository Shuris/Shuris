import type { CategoryId, Lesson, SkillId } from '../types';
import { COMBATE } from './combate';
import { FUNDAMENTOS } from './fundamentos';
import { MACRO } from './macro';
import { MENTALIDADE } from './mentalidade';
import { ROTAS } from './rotas';

/** Catálogo completo da Academy, na ordem da trilha. */
export const LESSONS: Lesson[] = [...FUNDAMENTOS, ...ROTAS, ...COMBATE, ...MACRO, ...MENTALIDADE];

const BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

export const lessonById = (id: string): Lesson | undefined => BY_ID.get(id);
export const lessonsByCategory = (category: CategoryId): Lesson[] => LESSONS.filter((l) => l.category === category);
export const lessonsBySkill = (skill: SkillId): Lesson[] => LESSONS.filter((l) => l.skills.includes(skill)).sort((a, b) => a.level - b.level);

/** Aproveitamento mínimo no teste para a aula contar como concluída. */
export const PASS_SCORE = 0.6;
