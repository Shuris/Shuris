// Versão 0.6: eventos da cidade, torneio, rivais e revanche, ferimentos, ferreiro,
// novos tipos de gladiador, salvamento v4 e retratos.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../../src/renderer/i18n';
import { PT } from '../../src/renderer/i18n/pt';
import { opponentDesc, opponentEpithet } from '../../src/renderer/i18n/data';
import { createPlayer } from '../../src/renderer/core/systems/PlayerFactory';
import { createRng } from '../../src/renderer/core/systems/rng';
import { ITEMS, MAX_PLUS, forgeCost, forged, getItem, sellPrice } from '../../src/renderer/core/data/equipment';
import { OPPONENTS, getOpponent } from '../../src/renderer/core/data/opponents';
import { CLASSES, POOL, freeChallenger, gearTier, poolOpponent } from '../../src/renderer/core/data/fighters';
import { opponentCombatant, playerCombatant } from '../../src/renderer/core/combat/CombatantFactory';
import { CombatEngine } from '../../src/renderer/core/combat/CombatEngine';
import { addItem } from '../../src/renderer/core/systems/EquipmentSystem';
import { equippedItems } from '../../src/renderer/core/systems/AttributeSystem';
import {
  armFee,
  buyFromMerchant,
  canArmWrestle,
  finishArmWrestle,
  isFestival,
  isMerchantDay,
  merchantDays,
  merchantStock,
} from '../../src/renderer/core/systems/EventSystem';
import {
  buildBracket,
  canRegister,
  canStart,
  closeTournament,
  checkNoShow,
  currentRound,
  playerMatch,
  recordPlayerFight,
  register,
  startTournament,
} from '../../src/renderer/core/systems/TournamentSystem';
import { applyInjury, canSeeMedic, expireRematch, fightDef, introMoment, ladderCheck, maybeAskRematch, rematchActive, seeMedic } from '../../src/renderer/core/systems/RivalSystem';
import { applyBattleResult } from '../../src/renderer/core/systems/ProgressionSystem';
import { bathe, sleep } from '../../src/renderer/core/systems/CalendarSystem';
import { forgeItem } from '../../src/renderer/core/systems/ForgeSystem';
import { NEWS_TPL, publish } from '../../src/renderer/core/systems/NewsSystem';
import { parseSave, serialize } from '../../src/renderer/core/systems/SaveSystem';
import { talk } from '../../src/renderer/core/data/dialogue';
import { PORTRAIT_IDS, PLAYER_PORTRAIT_LAYERS } from '../../src/renderer/game/portraits';
import { APPEARANCE } from './helpers';

const fresh = () => createPlayer('Maximus', 'gaul', APPEARANCE, 1000);
const ASSETS = path.resolve(__dirname, '../../src/renderer/public/assets');

afterEach(() => setLang('pt'));

describe('festival e mercador viajante', () => {
  it('festival a cada 14 dias dobra a fama das lutas', () => {
    const days = Array.from({ length: 60 }, (_, i) => i + 1).filter(isFestival);
    expect(days).toEqual([10, 24, 38, 52]);
    const opp = OPPONENTS[0];
    const a = fresh();
    a.day = 9;
    const b = fresh();
    b.day = 10;
    const ra = applyBattleResult(a, { opponent: opp, won: true, reason: 'ko', duration: 30, strategy: 'balanced', rng: createRng(1) });
    const rb = applyBattleResult(b, { opponent: opp, won: true, reason: 'ko', duration: 30, strategy: 'balanced', rng: createRng(1) });
    expect(rb.reputation).toBe(ra.reputation * 2);
    expect(rb.festival).toBe(true);
  });

  it('mercador aparece a cada 6 a 10 dias, nunca no domingo', () => {
    for (const seed of [1, 99, 123456, 987654321]) {
      const days = merchantDays(seed, 200);
      expect(days.length).toBeGreaterThan(15);
      for (let i = 1; i < days.length; i++) {
        const gap = days[i] - days[i - 1];
        expect(gap).toBeGreaterThanOrEqual(6);
        expect(gap).toBeLessThanOrEqual(11);
      }
      for (const d of days) expect(d % 7).not.toBe(0);
    }
  });

  it('vende raridades e cada uma só uma vez por visita', () => {
    const p = fresh();
    p.level = 12;
    p.coins = 100000;
    p.minutes = 10 * 60;
    p.day = merchantDays(p.createdAt, 60)[0];
    expect(isMerchantDay(p.createdAt, p.day)).toBe(true);
    const stock = merchantStock(p.createdAt, p.day, p.level);
    expect(stock).toHaveLength(3);
    expect(stock.some((o) => o.exotic && !o.item.shop)).toBe(true);
    const buyable = stock.find((o) => o.item.minLevel <= p.level)!;
    expect(buyFromMerchant(p, buyable.item.id)).toBeNull();
    expect(buyFromMerchant(p, buyable.item.id)).not.toBeNull();
    p.day += 1;
    expect(buyFromMerchant(p, buyable.item.id)).not.toBeNull();
  });
});

describe('queda de braço', () => {
  it('só domingo à noite, uma vez, com prêmio para quem vence', () => {
    const p = fresh();
    p.day = 6;
    p.minutes = 20 * 60;
    expect(canArmWrestle(p)).not.toBeNull();
    p.day = 7;
    p.minutes = 15 * 60;
    expect(canArmWrestle(p)).not.toBeNull();
    p.minutes = 20 * 60;
    expect(canArmWrestle(p)).toBeNull();
    const coins = p.coins;
    const r = finishArmWrestle(p, true);
    expect(p.coins).toBe(coins - armFee(fresh()) + r.coins);
    expect(r.fame).toBe(3);
    expect(canArmWrestle(p)).not.toBeNull();
  });
});

describe('torneio de sábado', () => {
  it('inscrição antecipada, chave de 8 e três rodadas', () => {
    const p = fresh();
    p.location = 'arena';
    p.day = 2;
    p.minutes = 10 * 60;
    expect(canRegister(p)).toBeNull();
    expect(register(p)).toBeNull();
    expect(p.tournament.registered).toBe(6);
    expect(canRegister(p)).not.toBeNull();
    p.day = 6;
    p.minutes = 13 * 60;
    expect(canStart(p)).not.toBeNull();
    p.minutes = 14 * 60;
    expect(startTournament(p)).toBeNull();
    const run = p.tournament.run!;
    expect(run.bracket).toHaveLength(8);
    expect(new Set(run.bracket).size).toBe(8);
    expect(run.bracket.filter((x) => x === 'player')).toHaveLength(1);
    for (let i = 0; i < 3; i++) {
      expect(currentRound(run)).toBe(i);
      expect(playerMatch(run)).not.toBeNull();
      recordPlayerFight(p, true);
    }
    expect(run.done).toBe(true);
    const prize = closeTournament(p, createRng(3))!;
    expect(prize.reached).toBe(3);
    expect(prize.itemId).not.toBeNull();
    expect(p.tournament.titles).toBe(1);
    expect(p.tournament.registered).toBe(0);
  });

  it('eliminado: o resto da chave é simulado; quem não aparece perde a inscrição', () => {
    const p = fresh();
    p.day = 6;
    p.minutes = 14 * 60;
    p.tournament.registered = 6;
    startTournament(p);
    recordPlayerFight(p, false);
    expect(p.tournament.run!.done).toBe(true);
    expect(p.tournament.run!.winners).toHaveLength(7);
    expect(closeTournament(p, createRng(1))!.reached).toBe(0);
    const q = fresh();
    q.tournament.registered = 6;
    q.day = 6;
    q.minutes = 17 * 60;
    expect(checkNoShow(q)).toBe(true);
    expect(q.tournament.registered).toBe(0);
  });

  it('chave estável para o mesmo gladiador e dia', () => {
    const p = fresh();
    p.day = 13;
    expect(buildBracket(p)).toEqual(buildBracket(p));
  });
});

describe('rivais e revanche', () => {
  it('derrotado só luta de novo se pedir revanche; ele treina enquanto espera', () => {
    const p = fresh();
    p.defeatedOpponents = ['marcus'];
    expect(ladderCheck(p, 'marcus')).not.toBeNull();
    p.rematch = { opponentId: 'marcus', askedDay: p.day, expires: p.day + 7 };
    expect(rematchActive(p, 'marcus')).toBe(true);
    expect(ladderCheck(p, 'marcus')).toBeNull();
    p.day += 4;
    expect(fightDef(p, getOpponent('marcus')!).level).toBe(getOpponent('marcus')!.level + 3);
    expect(introMoment(p, 'marcus')).toBe('rematch');
  });

  it('pedidos são raros: no máximo um a cada 7 dias', () => {
    const p = fresh();
    let asked = 0;
    for (let d = 1; d <= 70; d++) {
      p.day = d;
      if (p.rematch && d > p.rematch.expires) p.rematch = null;
      if (maybeAskRematch(p, 'marcus', () => 0)) asked++;
    }
    expect(asked).toBeLessThanOrEqual(10);
    expect(asked).toBeGreaterThan(0);
  });

  it('a revanche vencida rende mais e a memória do rival muda as falas', () => {
    const p = fresh();
    const opp = getOpponent('marcus')!;
    applyBattleResult(p, { opponent: opp, won: false, reason: 'decision', duration: 30, strategy: 'balanced', rng: createRng(5) });
    expect(introMoment(p, 'marcus')).toBe('gloat');
    expect(talk('marcus', 'gloat', 0)).not.toBe('');
    applyBattleResult(p, { opponent: opp, won: true, reason: 'ko', duration: 30, strategy: 'balanced', rng: createRng(5) });
    expect(p.rivals.marcus).toMatchObject({ wins: 1, losses: 1, last: 'win' });
    const q = fresh();
    const r1 = applyBattleResult(q, { opponent: opp, won: true, reason: 'ko', duration: 30, strategy: 'balanced', rng: createRng(9), mode: 'ladder' });
    const q2 = fresh();
    q2.defeatedOpponents = ['marcus'];
    const r2 = applyBattleResult(q2, { opponent: opp, won: true, reason: 'ko', duration: 30, strategy: 'balanced', rng: createRng(9), mode: 'rematch' });
    expect(r2.xp).toBeGreaterThan(r1.xp);
  });

  it('pedido esquecido expira e custa um pouco de fama', () => {
    const p = fresh();
    p.reputation = 10;
    p.rematch = { opponentId: 'cassius', askedDay: 2, expires: 8 };
    p.day = 9;
    expect(expireRematch(p)).toBe('cassius');
    expect(p.rematch).toBeNull();
    expect(p.reputation).toBe(8);
  });

  it('desafiantes avulsos mudam a cada luta e ficam perto do nível do jogador', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const c = freeChallenger(42, 5, i, 10);
      ids.add(`${c.id}:${c.level}`);
      expect(Math.abs(c.level - 10)).toBeLessThanOrEqual(1);
    }
    expect(ids.size).toBeGreaterThan(4);
  });
});

describe('novos tipos de gladiador (corpo a corpo)', () => {
  it('cada tipo tem equipamento válido em todas as faixas e luta no motor', () => {
    for (const c of Object.values(CLASSES)) {
      expect(c.gear).toHaveLength(4);
      for (const g of c.gear) for (const id of Object.values(g)) expect(getItem(id!), `${c.id}: ${id}`).toBeDefined();
    }
    const fresh4 = Object.values(CLASSES).filter((c) => c.fresh).map((c) => c.id);
    expect(fresh4.sort()).toEqual(['crupellarius', 'dimachaerus', 'provocator', 'scissor']);
    for (const f of POOL) {
      const def = poolOpponent(f, 12);
      const res = new CombatEngine(opponentCombatant(def).spec, opponentCombatant(poolOpponent(POOL[0], 12)).spec, { seed: 7 }).runToEnd();
      expect(res.duration).toBeGreaterThan(0);
      expect(opponentEpithet(def)).not.toMatch(/^class\./);
      setLang('en');
      expect(opponentDesc(def)).not.toMatch(/^class\./);
      setLang('pt');
    }
  });

  it('dimachaerus: segundo gládio sem bloqueio de escudo', () => {
    const def = poolOpponent(POOL.find((f) => f.cls === 'dimachaerus')!, 8);
    expect(def.equipment.offHand).toBe('twin_gladius');
    expect(opponentCombatant(def).spec.stats.hasShield).toBe(false);
    expect(gearTier(8)).toBe(1);
  });
});

describe('ferimentos', () => {
  it('nocaute ou desistência ferem; sono, termas ou médico curam', () => {
    const p = fresh();
    expect(applyInjury(p, 'decision', createRng(1))).toBe(0);
    expect(applyInjury(p, 'forfeit', createRng(1))).toBe(1);
    const hp = playerCombatant(p).spec.stats.maxHp;
    p.injury = null;
    expect(playerCombatant(p).spec.stats.maxHp).toBeGreaterThan(hp);
    p.injury = { days: 2 };
    sleep(p);
    expect(p.injury).toEqual({ days: 1 });
    p.minutes = 10 * 60;
    p.coins = 500;
    expect(bathe(p)).toBeNull();
    expect(p.injury).toBeNull();
    p.injury = { days: 2 };
    p.minutes = 10 * 60;
    expect(canSeeMedic(p)).toBeNull();
    expect(seeMedic(p)).toBeNull();
    expect(p.injury).toBeNull();
    expect(canSeeMedic(p)).not.toBeNull();
  });

  it('derrota por nocaute na luta deixa ferido', () => {
    const p = fresh();
    const r = applyBattleResult(p, { opponent: OPPONENTS[0], won: false, reason: 'ko', duration: 30, strategy: 'balanced', rng: createRng(2) });
    expect(r.injuryDays).toBeGreaterThanOrEqual(1);
    expect(p.injury?.days).toBe(r.injuryDays);
  });
});

describe('ferreiro', () => {
  it('melhora até +3, com custo crescente; o item melhorado rende mais', () => {
    const p = fresh();
    p.level = 20;
    p.coins = 100000;
    p.minutes = 9 * 60;
    const inv = addItem(p, 'gladius');
    p.equipment.mainHand = inv.uid;
    const before = equippedItems(p).mainHand!.mods.damage!;
    const costs: number[] = [];
    for (let i = 0; i < MAX_PLUS; i++) {
      costs.push(forgeCost(getItem('gladius')!, i));
      expect(forgeItem(p, inv.uid).error).toBeNull();
    }
    expect(forgeItem(p, inv.uid).error).not.toBeNull();
    expect(inv.plus).toBe(3);
    expect(costs[0]).toBeLessThan(costs[1]);
    expect(costs[1]).toBeLessThan(costs[2]);
    expect(equippedItems(p).mainHand!.mods.damage!).toBeGreaterThan(before);
    expect(sellPrice(getItem('gladius')!, 3)).toBeGreaterThan(sellPrice(getItem('gladius')!));
    const shield = forged(getItem('scutum')!, 2);
    expect(shield.mods.defense!).toBeGreaterThan(getItem('scutum')!.mods.defense!);
    expect(shield.plus).toBe(2);
  });

  it('rúdis de madeira não vai à forja', () => {
    const p = fresh();
    p.minutes = 9 * 60;
    expect(forgeItem(p, p.inventory[0].uid).error).not.toBeNull();
  });
});

describe('jornal 0.6', () => {
  it('novos modelos têm texto e ilustrações existem', () => {
    for (const [group, n] of Object.entries(NEWS_TPL))
      for (let i = 0; i < n; i++) {
        expect(PT[`news.${group}.${i}.h` as keyof typeof PT], `${group}.${i}`).toBeTruthy();
        expect(PT[`news.${group}.${i}.b` as keyof typeof PT], `${group}.${i}`).toBeTruthy();
      }
    for (const img of ['festival', 'merchant', 'armwrestle', 'tournament']) {
      expect(fs.existsSync(path.join(ASSETS, 'news', `${img}.png`))).toBe(true);
      expect(PT[`news.img.${img}` as keyof typeof PT]).toBeTruthy();
    }
  });

  it('o jornal da manhã avisa festival, mercador e torneio', () => {
    const p = fresh();
    p.day = 9; // amanhã é festival
    const ed = publish(p, createRng(1))!;
    expect(ed.items.some((n) => n.tpl?.startsWith('festivalSoon'))).toBe(true);
    p.day = 5; // sexta: inscrições do torneio
    expect(publish(p, createRng(2))!.items.some((n) => n.tpl?.startsWith('tourneySoon'))).toBe(true);
  });
});

describe('salvamento versão 4', () => {
  it('rivais, revanche, ferimento, torneio, eventos e melhorias do ferreiro sobrevivem', () => {
    const p = fresh();
    p.rivals = { marcus: { wins: 2, losses: 1, lastDay: 3, last: 'win' } };
    p.rematch = { opponentId: 'marcus', askedDay: 4, expires: 10 };
    p.lastRematchDay = 3;
    p.injury = { days: 2 };
    p.day = 6;
    p.minutes = 14 * 60;
    p.tournament.registered = 6;
    startTournament(p);
    p.events.armWins = 3;
    p.inventory[0].plus = 2;
    const r = parseSave(serialize(p));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const q = r.player;
    expect(q.rivals).toEqual(p.rivals);
    expect(q.rematch).toEqual(p.rematch);
    expect(q.injury).toEqual({ days: 2 });
    expect(q.tournament.run).toEqual(p.tournament.run);
    expect(q.events.armWins).toBe(3);
    expect(q.inventory[0].plus).toBe(2);
  });

  it('save antigo (v3) recebe os valores iniciais e dados inválidos são descartados', () => {
    const p = fresh() as unknown as Record<string, unknown>;
    for (const k of ['rivals', 'rematch', 'lastRematchDay', 'injury', 'tournament', 'events']) delete p[k];
    (p.inventory as Array<Record<string, unknown>>)[0].plus = 99;
    const r = parseSave(JSON.stringify({ format: 'colosseum-save', version: 3, savedAt: 1, player: p }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.player.rivals).toEqual({});
    expect(r.player.rematch).toBeNull();
    expect(r.player.injury).toBeNull();
    expect(r.player.tournament).toEqual({ registered: 0, run: null, titles: 0, best: -1 });
    expect(r.player.inventory[0].plus).toBe(3);
  });
});

describe('retratos e itens novos', () => {
  it('todo personagem com fala tem retrato em pixel art', () => {
    for (const id of [...PORTRAIT_IDS, ...PLAYER_PORTRAIT_LAYERS]) expect(fs.existsSync(path.join(ASSETS, 'portraits', `${id}.png`)), id).toBe(true);
  });

  it('itens novos têm ícone e folha de sprite', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ASSETS, 'sprites/gladiator/manifest.json'), 'utf8'));
    for (const id of ['arbelas', 'twin_gladius', 'provocator_helm', 'secutor_helm', 'crupellarius_helm', 'cardiophylax', 'scale_armor']) {
      const it = ITEMS.find((i) => i.id === id)!;
      expect(fs.existsSync(path.join(ASSETS, 'ui/items', `${it.visual.icon}.png`)), id).toBe(true);
      for (const s of it.visual.sheets) expect(manifest.sheets[s] || manifest.weapons[s.replace('weapon_', '')], s).toBeTruthy();
    }
  });
});

describe('jornal: uma notícia por adversário (0.7)', () => {
  it('não publica "vence" e "provoca" sobre o mesmo adversário, nem dois resultados', async () => {
    const { editionItems } = await import('../../src/renderer/core/systems/NewsSystem');
    const mk = (tpl: string, v: Record<string, string>) => ({ id: tpl, kind: 'city' as const, tpl, v, headline: '', body: '' });
    const items = [
      mk('rival.0', { name: 'Max', rival: 'brutus' }),
      mk('victory.0', { name: 'Max', opp: 'brutus', arena: 'capua' }),
      mk('lossKo.0', { name: 'Max', opp: 'pool_nubia', arena: 'capua' }),
      mk('tourneyWin.0', { name: 'Max', opp: '' }),
      mk('city.1', {}),
    ];
    const out = editionItems(items).map((n) => n.tpl);
    expect(out[0]).toBe('tourneyWin.0');
    expect(out).not.toContain('victory.0');
    expect(out).not.toContain('lossKo.0');
    expect(out.filter((x) => x === 'rival.0').length).toBeLessThanOrEqual(1);
    expect(out).toContain('city.1');
  });
});
