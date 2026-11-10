import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/renderer/core/systems/PlayerFactory';
import { canLearn, combinedMods, learn, respec, respecCost, skillsFromPerks, autoPerks } from '../../src/renderer/core/systems/SkillTreeSystem';
import { FIGHT_ENERGY, applyFight, bathe, canFight, canTrain, canTravel, sleep, travel, TRAVEL_MINUTES } from '../../src/renderer/core/systems/CalendarSystem';
import { checkFame, nextRival, publish, unreadCount, onBattle } from '../../src/renderer/core/systems/NewsSystem';
import { applyBattleResult, grantXp, xpToNext } from '../../src/renderer/core/systems/ProgressionSystem';
import { parseSave, serialize } from '../../src/renderer/core/systems/SaveSystem';
import { playerCombatant } from '../../src/renderer/core/combat/CombatantFactory';
import { OPPONENTS } from '../../src/renderer/core/data/opponents';
import { PERKS } from '../../src/renderer/core/data/skillTree';
import { createRng } from '../../src/renderer/core/systems/rng';
import { APPEARANCE } from './helpers';

const fresh = () => createPlayer('Maximus', 'gaul', APPEARANCE, 1000);

describe('árvore de habilidades', () => {
  it('começa com 2 pontos e ganha 1 por nível', () => {
    const p = fresh();
    expect(p.skillPoints).toBe(2);
    grantXp(p, xpToNext(1));
    expect(p.skillPoints).toBe(3);
  });
  it('respeita pré-requisitos e custo', () => {
    const p = fresh();
    expect(canLearn(p, 'm2')).not.toBeNull(); // precisa de m1
    expect(learn(p, 'm1')).toBeNull();
    expect(learn(p, 'm2')).toBeNull();
    expect(p.skillPoints).toBe(0);
    expect(canLearn(p, 'm3a')).toMatch(/ponto/);
    expect(skillsFromPerks(p.perks)).toEqual(['power_strike']);
  });
  it('habilidades e bônus afetam o combate', () => {
    const p = fresh();
    const base = playerCombatant(p).spec;
    expect(base.skills).toEqual([]);
    learn(p, 'd1');
    learn(p, 'd2');
    const s = playerCombatant(p).spec;
    expect(s.skills).toContain('iron_guard');
    expect(s.stats.maxHp).toBeGreaterThan(base.stats.maxHp);
    expect(combinedMods(['m1', 'm5']).damageMul).toBeCloseTo(0.13);
  });
  it('recomeçar devolve os pontos por moedas', () => {
    const p = fresh();
    learn(p, 'v1');
    learn(p, 'v2');
    p.coins = 1000;
    const cost = respecCost(p);
    expect(respec(p)).toBeNull();
    expect(p.perks).toEqual([]);
    expect(p.skillPoints).toBe(2);
    expect(p.coins).toBe(1000 - cost);
    expect(respecCost(p)).toBeGreaterThan(cost);
  });
  it('não dá para completar a árvore toda (escolhas importam)', () => {
    const total = PERKS.reduce((s, pk) => s + pk.cost, 0);
    expect(total).toBeGreaterThan(1 + 30);
    expect(autoPerks(30, ['mars', 'mercury', 'minerva'], true).length).toBeLessThan(PERKS.length);
  });
});

describe('sistema de dias', () => {
  it('lutar gasta energia e horas; sem energia não luta', () => {
    const p = fresh();
    p.minutes = 9 * 60;
    expect(canFight(p)).toBeNull();
    applyFight(p);
    applyFight(p);
    expect(p.energy).toBe(100 - 2 * FIGHT_ENERGY);
    applyFight(p);
    expect(canFight(p)).toMatch(/energia|fechada/);
  });
  it('arena fecha à noite e nada passa da meia-noite', () => {
    const p = fresh();
    p.minutes = 21 * 60;
    expect(canFight(p)).toMatch(/fechada/);
    p.minutes = 23 * 60 + 50;
    expect(canTrain(p)).not.toBeNull();
    expect(canTravel(p, 'market')).toMatch(/dormir/);
    p.location = 'market';
    expect(canTravel(p, 'home')).toBeNull();
  });
  it('dormir inicia novo dia com energia cheia', () => {
    const p = fresh();
    p.energy = 5;
    p.location = 'home';
    sleep(p);
    expect(p.day).toBe(2);
    expect(p.minutes).toBe(7 * 60);
    expect(p.energy).toBe(100);
  });
  it('viajar leva tempo e termas recuperam energia', () => {
    const p = fresh();
    const m = p.minutes;
    expect(travel(p, 'baths')).toBeNull();
    expect(p.minutes).toBe(m + TRAVEL_MINUTES);
    p.energy = 30;
    p.coins = 500;
    p.minutes = 10 * 60;
    expect(bathe(p)).toBeNull();
    expect(p.energy).toBe(70);
  });
});

describe('jornal Acta Diurna', () => {
  it('estreia já tem edição com o nome do gladiador', () => {
    const p = fresh();
    expect(p.news.editions.length).toBe(1);
    expect(p.news.editions[0].items[0].body).toContain('Maximus');
    expect(unreadCount(p)).toBe(1);
  });
  it('fama gera manchete citando o próximo rival, publicada na manhã seguinte', () => {
    const p = fresh();
    p.reputation = 12;
    checkFame(p, createRng(1));
    expect(p.news.pending.length).toBeGreaterThan(0);
    const all = p.news.pending.map((n) => n.headline + n.body).join(' ');
    expect(all).toContain('Maximus');
    expect(all).toContain(nextRival(p).name);
    sleep(p);
    const ed = publish(p, createRng(2));
    expect(ed?.day).toBe(2);
    expect(p.news.pending.length).toBe(0);
    expect(ed!.items.some((n) => n.kind === 'fame')).toBe(true);
  });
  it('vitórias e sequências viram notícia', () => {
    const p = fresh();
    for (let i = 0; i < 3; i++) applyBattleResult(p, { opponent: OPPONENTS[0], won: true, reason: 'ko', duration: 60, strategy: 'balanced', rng: createRng(i) });
    const kinds = p.news.pending.map((n) => n.kind);
    expect(kinds).toContain('victory');
    expect(kinds).toContain('streak');
    onBattle(p, OPPONENTS[0], false, false, createRng(9));
    expect(p.streak).toBe(3); // onBattle não altera a sequência sozinho
  });
  it('salvamento preserva calendário, árvore e jornal; save v1 é migrado', () => {
    const p = fresh();
    learn(p, 'm1');
    p.day = 5;
    p.energy = 40;
    const r = parseSave(serialize(p));
    expect(r.ok && r.player).toEqual(p);
    const v1 = { ...fresh() } as unknown as Record<string, unknown>;
    for (const k of ['day', 'minutes', 'energy', 'location', 'skillPoints', 'perks', 'respecs', 'streak', 'news']) delete v1[k];
    v1.level = 4;
    const m = parseSave(JSON.stringify({ format: 'colosseum-save', version: 1, savedAt: 0, player: v1 }));
    expect(m.ok && m.player.skillPoints).toBe(5);
    expect(m.ok && m.player.day).toBe(1);
    expect(m.ok && m.player.energy).toBe(100);
  });
});
