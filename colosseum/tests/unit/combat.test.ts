import { describe, expect, it } from 'vitest';
import { ARENA_MAX_X, ARENA_MIN_X, BODY_GAP, CombatEngine } from '../../src/renderer/core/combat/CombatEngine';
import { opponentCombatant, playerCombatant } from '../../src/renderer/core/combat/CombatantFactory';
import type { CombatEvent } from '../../src/renderer/core/combat/CombatTypes';
import { OPPONENTS } from '../../src/renderer/core/data/opponents';
import { typicalPlayer } from './helpers';

const opp = OPPONENTS[3];

function run(seed: number, strategy: 'aggressive' | 'balanced' | 'defensive' = 'balanced', o = opp) {
  const p = typicalPlayer(o, strategy);
  const eng = new CombatEngine(playerCombatant(p).spec, opponentCombatant(o).spec, { seed });
  const events: CombatEvent[] = [];
  let minGap = Infinity;
  let bounds = true;
  let hpOk = true;
  while (!eng.finished) {
    events.push(...eng.step());
    const [a, b] = eng.fighters;
    if (eng.started) minGap = Math.min(minGap, Math.abs(a.x - b.x));
    for (const f of eng.fighters) {
      if (eng.started && (f.x < ARENA_MIN_X - 0.01 || f.x > ARENA_MAX_X + 0.01)) bounds = false;
      if (f.hp < 0 || f.stamina < 0) hpOk = false;
    }
  }
  return { eng, events, minGap, bounds, hpOk };
}

describe('motor de combate', () => {
  it('é determinístico para a mesma semente', () => {
    const a = run(42).eng.result;
    const b = run(42).eng.result;
    expect(a).toEqual(b);
  });
  it('sempre termina e respeita limites físicos', () => {
    for (let s = 0; s < 40; s++) {
      const r = run(s);
      expect(r.eng.finished).toBe(true);
      expect(r.bounds).toBe(true);
      expect(r.hpOk).toBe(true);
      expect(r.minGap).toBeGreaterThanOrEqual(BODY_GAP - 0.01);
      expect(r.events.filter((e) => e.type === 'end').length).toBe(1);
    }
  });
  it('emite todos os tipos de ação/resultado ao longo de várias lutas', () => {
    const kinds = new Set<string>();
    const outcomes = new Set<string>();
    const skills = new Set<string>();
    for (let s = 0; s < 30; s++) {
      for (const e of run(s, 'balanced', OPPONENTS[8]).events) {
        if (e.type === 'action') kinds.add(e.action);
        if (e.type === 'impact') outcomes.add(e.outcome);
        if (e.type === 'skill') skills.add(e.skill);
      }
    }
    for (const k of ['idle', 'advance', 'windup', 'recover', 'block', 'dodge', 'hitstun', 'victory', 'defeat']) expect(kinds).toContain(k);
    for (const o of ['hit', 'miss', 'dodge', 'block']) expect(outcomes).toContain(o);
    for (const sk of ['power_strike', 'iron_guard', 'quick_strike', 'counter']) expect(skills).toContain(sk);
  });
  it('a estratégia altera o comportamento', () => {
    let aggAttacks = 0;
    let defAttacks = 0;
    let aggBlocks = 0;
    let defBlocks = 0;
    for (let s = 0; s < 30; s++) {
      const a = run(s, 'aggressive');
      const d = run(s, 'defensive');
      aggAttacks += a.eng.fighters[0].counters.attacks / a.eng.fightTime;
      defAttacks += d.eng.fighters[0].counters.attacks / d.eng.fightTime;
      aggBlocks += a.events.filter((e) => e.type === 'action' && e.side === 0 && e.action === 'block').length;
      defBlocks += d.events.filter((e) => e.type === 'action' && e.side === 0 && e.action === 'block').length;
    }
    expect(aggAttacks).toBeGreaterThan(defAttacks * 1.2);
    expect(defBlocks).toBeGreaterThan(aggBlocks * 1.5);
  });
  it('lutas duram em média entre 45 e 90 segundos', () => {
    let total = 0;
    for (let s = 0; s < 60; s++) total += run(s).eng.result!.duration;
    const avg = total / 60;
    expect(avg).toBeGreaterThan(45);
    expect(avg).toBeLessThan(90);
  });
  it('desistência encerra com derrota de quem desistiu', () => {
    const p = typicalPlayer(opp);
    const eng = new CombatEngine(playerCombatant(p).spec, opponentCombatant(opp).spec, { seed: 1 });
    for (let i = 0; i < 100; i++) eng.step();
    eng.forfeit(0);
    expect(eng.result?.winner).toBe(1);
    expect(eng.result?.reason).toBe('forfeit');
  });
  it('nível não decide sozinho: atributos e equipamento importam', () => {
    const strong = typicalPlayer(OPPONENTS[2]);
    const naked = typicalPlayer(OPPONENTS[2]);
    naked.equipment = { mainHand: null, offHand: null, head: null, body: null, legs: null };
    let wins = 0;
    for (let s = 0; s < 40; s++) {
      if (new CombatEngine(playerCombatant(strong).spec, playerCombatant(naked).spec, { seed: s }).runToEnd().winner === 0) wins++;
    }
    expect(wins).toBeGreaterThan(30);
  });
});
