// 0.8: fama perdida em derrotas e por faltar ao torneio; aviso do torneio no jornal
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/renderer/core/systems/PlayerFactory';
import { createRng } from '../../src/renderer/core/systems/rng';
import { getOpponent, OPPONENTS } from '../../src/renderer/core/data/opponents';
import { applyBattleResult, lossFame } from '../../src/renderer/core/systems/ProgressionSystem';
import { checkNoShow, NO_SHOW_FAME } from '../../src/renderer/core/systems/TournamentSystem';
import { publish } from '../../src/renderer/core/systems/NewsSystem';
import { parseSave, serialize } from '../../src/renderer/core/systems/SaveSystem';
import { APPEARANCE } from './helpers';

const fresh = () => createPlayer('Maximus', 'gaul', APPEARANCE, 1000);
const lose = (p: ReturnType<typeof fresh>, mode?: 'ladder' | 'free' | 'rematch' | 'tournament', id = OPPONENTS[0].id) =>
  applyBattleResult(p, { opponent: getOpponent(id)!, won: false, reason: 'ko', duration: 30, strategy: 'balanced', rng: createRng(3), mode });

describe('fama nas derrotas', () => {
  it('perder uma luta comum tira um pouco de fama', () => {
    const p = fresh();
    p.reputation = 40;
    const r = lose(p);
    expect(r.reputation).toBe(-lossFame(OPPONENTS[0].level));
    expect(p.reputation).toBe(40 - lossFame(OPPONENTS[0].level));
    expect(p.history[0].reputation).toBeLessThan(0);
  });

  it('a perda é bem menor que faltar ao torneio e a fama nunca fica negativa', () => {
    for (const o of OPPONENTS) expect(lossFame(o.level)).toBeLessThan(NO_SHOW_FAME / 4);
    const p = fresh();
    p.reputation = 1;
    lose(p);
    expect(p.reputation).toBe(0);
  });

  it('derrota no torneio não tira fama', () => {
    const p = fresh();
    p.reputation = 30;
    expect(lose(p, 'tournament').reputation).toBe(0);
    expect(p.reputation).toBe(30);
  });

  it('o histórico com fama negativa sobrevive ao salvar e carregar', () => {
    const p = fresh();
    p.reputation = 20;
    lose(p);
    const back = parseSave(serialize(p));
    expect(back.ok && back.player.history[0].reputation).toBe(p.history[0].reputation);
  });
});

describe('torneio: falta e aviso', () => {
  it('quem se inscreve e falta perde 50 de fama', () => {
    const p = fresh();
    p.reputation = 80;
    p.tournament.registered = 6;
    p.day = 7;
    expect(checkNoShow(p)).toBe(true);
    expect(p.reputation).toBe(80 - NO_SHOW_FAME);
    const q = fresh();
    q.reputation = 10;
    q.tournament.registered = 6;
    q.day = 7;
    checkNoShow(q);
    expect(q.reputation).toBe(0);
  });

  it('no sábado de manhã o jornal avisa que hoje é o torneio (só para quem se inscreveu)', () => {
    const p = fresh();
    p.day = 6;
    p.tournament.registered = 6;
    const ed = publish(p, createRng(4))!;
    expect(ed.items.some((n) => n.tpl?.startsWith('tourneyToday'))).toBe(true);
    const q = fresh();
    q.day = 6;
    const ed2 = publish(q, createRng(4));
    expect((ed2?.items ?? []).some((n) => n.tpl?.startsWith('tourneyToday'))).toBe(false);
  });
});
