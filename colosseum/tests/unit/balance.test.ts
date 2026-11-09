import { describe, expect, it } from 'vitest';
import { CombatEngine } from '../../src/renderer/core/combat/CombatEngine';
import { opponentCombatant, playerCombatant } from '../../src/renderer/core/combat/CombatantFactory';
import { OPPONENTS } from '../../src/renderer/core/data/opponents';
import type { StrategyId } from '../../src/renderer/core/model/types';
import { typicalPlayer } from './helpers';

const N = 150;

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

describe('balanceamento (simulação de lutas)', () => {
  const rows: string[] = [];
  for (const opp of OPPONENTS) {
    it(`jogador típico vs ${opp.name} (nível ${opp.level})`, () => {
      const res: Record<StrategyId, { wins: number; durations: number[]; kos: number }> = {
        aggressive: { wins: 0, durations: [], kos: 0 },
        balanced: { wins: 0, durations: [], kos: 0 },
        defensive: { wins: 0, durations: [], kos: 0 },
      };
      for (const strat of Object.keys(res) as StrategyId[]) {
        const p = typicalPlayer(opp, strat);
        for (let i = 0; i < N; i++) {
          const eng = new CombatEngine(playerCombatant(p).spec, opponentCombatant(opp).spec, { seed: 1000 + i });
          const r = eng.runToEnd();
          if (r.winner === 0) res[strat].wins++;
          if (r.reason === 'ko') res[strat].kos++;
          res[strat].durations.push(r.duration);
        }
      }
      const line = (Object.keys(res) as StrategyId[])
        .map((s) => `${s.slice(0, 3)} win ${((res[s].wins / N) * 100).toFixed(0)}% med ${median(res[s].durations).toFixed(0)}s ko ${((res[s].kos / N) * 100).toFixed(0)}%`)
        .join(' | ');
      rows.push(`${opp.name.padEnd(9)} L${String(opp.level).padStart(2)}: ${line}`);
      console.log(rows[rows.length - 1]);
      const med = median(res.balanced.durations);
      expect(med).toBeGreaterThan(35);
      expect(med).toBeLessThan(100);
      // nenhuma estratégia deve ser absolutamente dominante ou inútil
      for (const s of Object.keys(res) as StrategyId[]) {
        expect(res[s].wins / N).toBeGreaterThan(0.1);
        expect(res[s].wins / N).toBeLessThan(0.95);
      }
    });
  }
});
