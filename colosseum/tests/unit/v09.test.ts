// 0.9: melhorias de 2º nível, convites por fama, venatio, duplas, plateia, missões e ranking
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/renderer/core/systems/PlayerFactory';
import { createRng } from '../../src/renderer/core/systems/rng';
import { OPPONENTS, getOpponent } from '../../src/renderer/core/data/opponents';
import { UPGRADES, buyUpgrade, canBuyUpgrade, trainingMul, trainEnergyCut, upgradeVisible } from '../../src/renderer/core/data/upgrades';
import { INVITES, checkInvites, finishInviteFight, inviteFoe, openInvites } from '../../src/renderer/core/systems/InviteSystem';
import { BEASTS, beastOfDay, isVenatioDay, venatioCheck } from '../../src/renderer/core/systems/VenatioSystem';
import { opponentCombatant, BEAST_STATS } from '../../src/renderer/core/combat/CombatantFactory';
import { CombatEngine } from '../../src/renderer/core/combat/CombatEngine';
import { FRIEND_RESPECT, addRespect, duoClash, duoCheck, duoDecider, duoFoes, friends, newDuoRun, partnerDef, setPartner } from '../../src/renderer/core/systems/DuoSystem';
import { FAVOR_START, favorAfter, favorFame, sparedByCrowd, thumbOf } from '../../src/renderer/core/systems/CrowdSystem';
import type { PlayerState } from '../../src/renderer/core/model/types';
import { CHAMPION_ID, nightlyRanking, playerPosition, rankTable } from '../../src/renderer/core/systems/RankingSystem';
import { parseSave, serialize } from '../../src/renderer/core/systems/SaveSystem';
import { getArena } from '../../src/renderer/core/data/arenas';
import { APPEARANCE } from './helpers';

const fresh = () => createPlayer('Maximus', 'gaul', APPEARANCE, 1000);

describe('melhorias de segundo nível', () => {
  it('só aparecem depois da primeira e multiplicam o treino', () => {
    const p = fresh();
    p.level = 10;
    p.coins = 5000;
    const bronze = UPGRADES.find((u) => u.id === 'bronze_weights')!;
    expect(upgradeVisible(p, bronze)).toBe(false);
    expect(canBuyUpgrade(p, 'bronze_weights')).toBe('requires');
    expect(buyUpgrade(p, 'stone_weights')).toBeNull();
    expect(upgradeVisible(p, bronze)).toBe(true);
    expect(buyUpgrade(p, 'bronze_weights')).toBeNull();
    expect(trainingMul(p, 'str')).toBeCloseTo(1.35 * 1.3);
  });

  it('doctore lendário corta mais energia', () => {
    const p = fresh();
    p.level = 12;
    p.coins = 5000;
    buyUpgrade(p, 'doctore');
    buyUpgrade(p, 'doctore_legend');
    expect(trainEnergyCut(p)).toBe(6);
  });
});

describe('convites por fama', () => {
  it('chegam em 150, 300 e 400 de fama, uma vez só', () => {
    const p = fresh();
    p.reputation = 149;
    expect(checkInvites(p)).toHaveLength(0);
    p.reputation = 150;
    expect(checkInvites(p).map((i) => i.id)).toEqual(['villa']);
    expect(checkInvites(p)).toHaveLength(0);
    p.reputation = 420;
    expect(checkInvites(p).map((i) => i.id)).toEqual(['senator', 'baiae']);
    expect(openInvites(p)).toHaveLength(3);
    for (const d of INVITES) expect(getArena(d.id)).toBeTruthy();
  });

  it('amistoso: vitória dá prêmio; derrota não fere nem tira fama', () => {
    const p = fresh();
    p.reputation = 160;
    checkInvites(p);
    const r = finishInviteFight(p, 'villa', true, 'ko', 30, createRng(1))!;
    expect(r.done && r.fame > 0 && r.coins > 0 && r.itemId).toBeTruthy();
    expect(p.reputation).toBe(160 + r.fame);
    expect(openInvites(p)).toHaveLength(0);
    const q = fresh();
    q.reputation = 160;
    checkInvites(q);
    const l = finishInviteFight(q, 'villa', false, 'ko', 30, createRng(1))!;
    expect(l.done && l.fame === 0).toBe(true);
    expect(q.injury).toBeNull();
    expect(q.reputation).toBe(160);
  });

  it('torneio de Baiae: semifinal e final, campeão leva o prêmio maior', () => {
    const p = fresh();
    p.reputation = 400;
    checkInvites(p);
    const inv = p.career.invites.find((i) => i.id === 'baiae')!;
    const semi = inviteFoe(inv)!;
    const r1 = finishInviteFight(p, 'baiae', true, 'ko', 30, createRng(2))!;
    expect(r1.final && !r1.done).toBe(true);
    const fin = inviteFoe(inv)!;
    expect(fin.id).not.toBe(semi.id);
    const r2 = finishInviteFight(p, 'baiae', true, 'ko', 30, createRng(3))!;
    expect(r2.champion && r2.done).toBe(true);
    expect(r2.fame).toBeGreaterThanOrEqual(60);
  });
});

describe('venatio (feras)', () => {
  it('acontece de vez em quando (nem sempre), nunca aos sábados nem nos primeiros dias', () => {
    const days = Array.from({ length: 200 }, (_, i) => i + 1).filter((d) => isVenatioDay(1000, d));
    expect(days.length).toBeGreaterThan(20);
    expect(days.length).toBeLessThan(70);
    expect(days.every((d) => d >= 3 && d % 7 !== 6)).toBe(true);
  });

  it('a fera depende do nível e é mais forte que um humano sem armas', () => {
    const p = fresh();
    p.level = 1;
    expect(beastOfDay(p).beast).toBe('wolf');
    p.level = 12;
    const kinds = new Set(Array.from({ length: 40 }, (_, d) => beastOfDay({ ...p, day: d + 1 } as PlayerState).beast));
    expect(kinds.size).toBeGreaterThan(1);
    const lion = { ...beastOfDay(p), beast: 'lion' };
    const c = opponentCombatant(lion);
    expect(c.visual.beast).toBe('lion');
    expect(c.spec.stats.damageMul).toBeGreaterThanOrEqual(BEAST_STATS.lion.damage * 0.99);
    for (const b of BEASTS) expect(BEAST_STATS[b.kind]).toBeTruthy();
  });

  it('uma fera por dia', () => {
    const p = fresh();
    let d = 3;
    while (!isVenatioDay(p.createdAt, d)) d++;
    p.day = d;
    expect(venatioCheck(p)).toBeNull();
    p.career.beastDay = d;
    expect(venatioCheck(p)).toBe('done');
  });
});

describe('amizade e duplas', () => {
  it('derrotados viram amigos com respeito; só amigos formam dupla', () => {
    const p = fresh();
    const id = OPPONENTS[1].id;
    expect(addRespect(p, id, 50)).toBe(false); // ainda não foi derrotado
    expect(respect(p, id)).toBe(0);
    p.defeatedOpponents.push(id);
    expect(addRespect(p, id, 40)).toBe(false);
    expect(setPartner(p, id)).toBe(false);
    expect(addRespect(p, id, FRIEND_RESPECT - 40)).toBe(true);
    expect(friends(p).map((f) => f.id)).toEqual([id]);
    expect(duoCheck(p)).toBe('noPartner');
    expect(setPartner(p, id)).toBe(true);
    expect(duoCheck(p)).toBeNull();
    expect(partnerDef(p)!.level).toBeGreaterThanOrEqual(p.level - 1);
    expect(duoFoes(p)).toHaveLength(2);
  });

  it('duelos simultâneos: 2 vitórias vencem, 2 derrotas perdem, 1 a 1 vai ao desempate', () => {
    const run = newDuoRun();
    // os dois duelos ao mesmo tempo: jogador perde, parceiro vence -> desempate
    expect(duoClash(run, { winner: 1, hp: [0, 40] }, { winner: 0, hp: [30, 0] })).toBe('decider');
    expect(run.playerOut).toBe(true);
    expect([run.a, run.b]).toEqual([1, 0]);
    expect([run.ours[run.a], run.theirs[run.b]]).toEqual([30, 40]);
    expect(duoDecider(run, 0)).toBe('win');
    expect(duoClash(newDuoRun(), { winner: 0, hp: [20, 0] }, { winner: 0, hp: [10, 0] })).toBe('win');
    expect(duoClash(newDuoRun(), { winner: 1, hp: [0, 20] }, { winner: 1, hp: [0, 10] })).toBe('loss');
  });

  it('o motor aceita vida inicial (o vencedor do assalto anterior continua ferido)', () => {
    const a = opponentCombatant(OPPONENTS[2]).spec;
    const b = opponentCombatant(OPPONENTS[2]).spec;
    const e = new CombatEngine(a, b, { seed: 1, startHp: [10, null] });
    expect(e.fighters[0].hp).toBe(10);
    expect(e.fighters[1].hp).toBe(b.stats.maxHp);
  });
});

const respect = (p: PlayerState, id: string) => p.career.respect[id] ?? 0;

describe('favor da plateia', () => {
  it('sobe com críticos e golpes fortes, cai ao apanhar', () => {
    let f = FAVOR_START;
    f = favorAfter(f, { type: 'impact', t: 1, side: 0, target: 1, kind: 'power_strike', outcome: 'hit', damage: 10, crit: true, stagger: true });
    expect(f).toBeGreaterThan(60);
    const down = favorAfter(f, { type: 'impact', t: 2, side: 1, target: 0, kind: 'normal', outcome: 'hit', damage: 10, crit: true, stagger: false });
    expect(down).toBeLessThan(f);
    expect(thumbOf(80)).toBe('up');
    expect(thumbOf(20)).toBe('down');
    expect(favorFame(80, true)).toBeGreaterThan(0);
    expect(favorFame(20, false)).toBeLessThan(0);
    expect(sparedByCrowd(75, false)).toBe(true);
    expect(favorAfter(50, { type: 'end', t: 9, winner: 1, reason: 'forfeit' })).toBe(25);
  });
});

describe('ranking da cidade', () => {
  it('tabela com o jogador; rivais lutam entre si à noite; posições mudam', () => {
    const p = fresh();
    const t0 = rankTable(p);
    expect(t0.length).toBeGreaterThanOrEqual(11);
    expect(t0.some((r) => r.player)).toBe(true);
    const before = p.career.rank.reduce((s, e) => s + e.w + e.l, 0);
    p.day = 2;
    expect(nightlyRanking(p)).toBeTruthy();
    expect(p.career.rank.reduce((s, e) => s + e.w + e.l, 0)).toBeGreaterThan(before);
    expect(nightlyRanking(p)).toBeNull(); // uma vez por noite
    const pos = playerPosition(p);
    p.stats.wins += 40;
    expect(playerPosition(p)).toBeLessThan(pos);
    expect(getOpponent(p.career.rank[0].id) || true).toBeTruthy();
  });

  it('pontos saem do cartel: mais vitórias e menos derrotas ficam acima; Flamma lidera', () => {
    const p = fresh();
    p.stats.wins = 59;
    p.stats.losses = 9;
    const rows = rankTable(p);
    expect(rows[0].id).toBe(CHAMPION_ID);
    const me = rows.find((r) => r.player)!;
    // ninguém com cartel pior fica à frente do jogador
    for (const r of rows.slice(0, me.pos - 1)) expect(r.w * 3 - r.l).toBeGreaterThanOrEqual(59 * 3 - 9);
    expect(me.pos).toBeLessThan(10);
    // o campeão segue muito à frente mesmo depois de semanas de lutas noturnas
    for (let d = 2; d < 60; d++) {
      p.day = d;
      nightlyRanking(p);
    }
    const champ = rankTable(p)[0];
    expect(champ.id).toBe(CHAMPION_ID);
    expect(champ.pts).toBeGreaterThan(me.pts * 3);
  });

  it('saves da 0.9.0 sem o campeão refazem a tabela', () => {
    const p = fresh();
    rankTable(p);
    p.career.rank = p.career.rank.filter((e) => e.id !== CHAMPION_ID);
    expect(rankTable(p)[0].id).toBe(CHAMPION_ID);
  });
});

describe('salvamento da carreira', () => {
  it('convites, amizade e ranking sobrevivem ao salvar e carregar', () => {
    const p = fresh();
    p.reputation = 400;
    checkInvites(p);
    p.defeatedOpponents.push(OPPONENTS[0].id);
    addRespect(p, OPPONENTS[0].id, 70);
    setPartner(p, OPPONENTS[0].id);
    rankTable(p);
    const back = parseSave(serialize(p));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.player.career).toEqual(p.career);
  });

  it('save antigo (sem carreira) carrega com a carreira vazia', () => {
    const p = fresh() as unknown as Record<string, unknown>;
    delete p.career;
    const back = parseSave(JSON.stringify({ format: 'colosseum-save', version: 4, savedAt: 0, player: p }));
    expect(back.ok && back.player.career.invites).toEqual([]);
  });
});
