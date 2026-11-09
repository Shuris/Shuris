import type { SkillId, StrategyId } from '../model/types';

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  trigger: string;
  unlockLevel: number;
  cooldown: number; // segundos
  staminaCost: number;
  icon: string;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  power_strike: {
    id: 'power_strike', name: 'Golpe poderoso', unlockLevel: 1, cooldown: 9, staminaCost: 24,
    description: 'Ataque preparado com o peso do corpo. Causa muito mais dano e consome mais resistência. A Técnica aumenta o dano.',
    trigger: 'Usado quando há fôlego de sobra (resistência acima de 45%).',
    icon: 'skill_power_strike',
  },
  iron_guard: {
    id: 'iron_guard', name: 'Defesa reforçada', unlockLevel: 1, cooldown: 18, staminaCost: 14,
    description: 'Fecha a guarda e reduz o dano recebido por alguns segundos. A Técnica aumenta a redução e a duração.',
    trigger: 'Usado quando a vida cai abaixo de 65% e o adversário está próximo.',
    icon: 'skill_iron_guard',
  },
  quick_strike: {
    id: 'quick_strike', name: 'Ataque rápido', unlockLevel: 3, cooldown: 5, staminaCost: 8,
    description: 'Estocada veloz com preparação e recuperação curtas. Dano um pouco menor.',
    trigger: 'Usado quando o adversário se recupera de um golpe, está atordoado ou exausto.',
    icon: 'skill_quick_strike',
  },
  counter: {
    id: 'counter', name: 'Contra-ataque', unlockLevel: 6, cooldown: 7, staminaCost: 8,
    description: 'Após bloquear ou esquivar, responde imediatamente com dano adicional. Não pode ser bloqueado nem esquivado.',
    trigger: 'Chance após um bloqueio ou esquiva bem-sucedidos (maior com Técnica).',
    icon: 'skill_counter',
  },
};

export const SKILL_ORDER: SkillId[] = ['power_strike', 'iron_guard', 'quick_strike', 'counter'];

export function skillsForLevel(level: number): SkillId[] {
  return SKILL_ORDER.filter((s) => SKILLS[s].unlockLevel <= level);
}

export interface StrategyDef {
  id: StrategyId;
  name: string;
  description: string;
  /** multiplicador do intervalo entre ataques */
  intervalMul: number;
  /** multiplicador do custo de resistência */
  staminaMul: number;
  damageMul: number;
  /** chance de reagir a um ataque bloqueando / esquivando */
  blockChance: number;
  dodgeChance: number;
  /** bônus somado à eficiência do bloqueio */
  blockBonus: number;
  /** bônus somado à chance de esquiva ativa (respeita o limite de 35%) */
  dodgeBonus: number;
  /** chance de usar o golpe poderoso quando disponível */
  powerChance: number;
  /** tendência a recuar para recuperar o fôlego / manter distância */
  caution: number;
}

export const STRATEGIES: Record<StrategyId, StrategyDef> = {
  aggressive: {
    id: 'aggressive', name: 'Agressiva',
    description: 'Prioriza ataques e pressão constante. Ataca com mais frequência e força, mas consome mais resistência e defende pouco.',
    intervalMul: 0.78, staminaMul: 1.25, damageMul: 1.12, blockChance: 0.12, dodgeChance: 0.08,
    blockBonus: 0, dodgeBonus: 0, powerChance: 0.8, caution: 0.05,
  },
  balanced: {
    id: 'balanced', name: 'Equilibrada',
    description: 'Distribui o esforço entre ataque e defesa.',
    intervalMul: 1, staminaMul: 1, damageMul: 1, blockChance: 0.3, dodgeChance: 0.18,
    blockBonus: 0.05, dodgeBonus: 0.02, powerChance: 0.5, caution: 0.25,
  },
  defensive: {
    id: 'defensive', name: 'Defensiva',
    description: 'Prioriza bloqueios e esquivas e espera o adversário errar. Ataca menos, mas defende com mais eficiência.',
    intervalMul: 1.3, staminaMul: 0.9, damageMul: 0.96, blockChance: 0.5, dodgeChance: 0.28,
    blockBonus: 0.1, dodgeBonus: 0.06, powerChance: 0.3, caution: 0.6,
  },
};
