export type ChallengeCategory = 'lane' | 'map' | 'macro' | 'teamfight' | 'matchups' | 'mechanics';
export type ChallengeDifficulty = 'facil' | 'medio' | 'dificil';

export const CATEGORY_LABEL: Record<ChallengeCategory, string> = {
  lane: 'Lane Management',
  map: 'Map Awareness',
  macro: 'Macro Game',
  teamfight: 'Team Fight',
  matchups: 'Matchups',
  mechanics: 'Mechanics',
};
export const CATEGORY_IDS = Object.keys(CATEGORY_LABEL) as ChallengeCategory[];

export const DIFFICULTY_LABEL: Record<ChallengeDifficulty, string> = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
export const DIFFICULTY_IDS: ChallengeDifficulty[] = ['facil', 'medio', 'dificil'];

/** Uma situação de jogo com uma decisão a tomar. */
export interface Challenge {
  id: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  title: string;
  /** A situação, como o jogador a veria na partida. */
  context: string;
  question: string;
  options: string[];
  /** Índice da alternativa correta. */
  answer: number;
  explanation: string;
  /** Aula da LOI Academy relacionada. */
  lessonId?: string;
}

/** Primeira resposta do usuário a um desafio (só ela vale XP). */
export interface ChallengeAttempt {
  challengeId: string;
  answer: number;
  correct: boolean;
  /** Epoch ms. */
  at: number;
  /** Dia local AAAA-MM-DD em que foi respondido. */
  day: string;
  /** true quando era o desafio diário daquele dia. */
  daily: boolean;
  xp: number;
  /** Histórico fictício da demonstração. */
  seeded?: boolean;
}
