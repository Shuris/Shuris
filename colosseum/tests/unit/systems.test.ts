import { describe, expect, it } from 'vitest';
import { createPlayer, sanitizeName, validateName } from '../../src/renderer/core/systems/PlayerFactory';
import { allocatePoints, computeCombatStats, playerCombatStats } from '../../src/renderer/core/systems/AttributeSystem';
import { buyItem, equipItem, sellItem, unequipSlot } from '../../src/renderer/core/systems/EquipmentSystem';
import { applyBattleResult, grantXp, isUnlocked, xpToNext } from '../../src/renderer/core/systems/ProgressionSystem';
import { train, trainingCost } from '../../src/renderer/core/systems/TrainingSystem';
import { parseSave, serialize } from '../../src/renderer/core/systems/SaveSystem';
import { createRng } from '../../src/renderer/core/systems/rng';
import { OPPONENTS } from '../../src/renderer/core/data/opponents';
import { ITEMS, getItem } from '../../src/renderer/core/data/equipment';
import { MAX_LEVEL } from '../../src/renderer/core/data/gladiators';
import { GameStore } from '../../src/renderer/core/GameStore';
import { APPEARANCE } from './helpers';

const fresh = () => createPlayer('Maximus', 'gaul', APPEARANCE, 1000);

describe('criação do gladiador', () => {
  it('cria com atributos básicos + bônus de origem', () => {
    const p = fresh();
    expect(p.level).toBe(1);
    expect(p.baseAttributes).toEqual({ str: 7, vit: 6, res: 5, agi: 5, prec: 5, tech: 5 });
    expect(p.inventory[0].itemId).toBe('rudis');
    expect(p.equipment.mainHand).toBe(p.inventory[0].uid);
  });
  it('valida nomes', () => {
    expect(validateName('A')).not.toBeNull();
    expect(validateName('<>')).not.toBeNull();
    expect(validateName('@@@')).not.toBeNull();
    expect(sanitizeName('<b>Nero</b>')).toBe('bNero/b');
    expect(validateName('Spartacus')).toBeNull();
    expect(validateName("Marco Túlio d'Ávila")).toBeNull();
  });
});

describe('atributos e fórmulas', () => {
  it('aplica as fórmulas da especificação', () => {
    const attrs = { str: 10, vit: 10, res: 10, agi: 10, prec: 10, tech: 10 };
    const s = computeCombatStats(attrs, {});
    expect(s.maxHp).toBe(100 + 10 * 12);
    expect(s.maxStamina).toBe(100 + 10 * 10);
    expect(s.baseDamage).toBeCloseTo(8 + 10 * 1.8);
    expect(s.dodgeChance).toBeCloseTo(0.05 + 10 * 0.005);
  });
  it('respeita limites de esquiva (35%) e intervalo mínimo (0,8 s)', () => {
    const s = computeCombatStats({ str: 0, vit: 0, res: 0, agi: 200, prec: 0, tech: 0 }, {});
    expect(s.dodgeChance).toBeLessThanOrEqual(0.35);
    expect(s.attackInterval).toBeGreaterThanOrEqual(0.8);
    const t = computeCombatStats({ str: 0, vit: 0, res: 999, agi: 0, prec: 0, tech: 0 }, {});
    expect(t.damageReduction).toBeLessThanOrEqual(0.7);
  });
  it('distribui pontos sem permitir negativos ou excesso', () => {
    const p = fresh();
    p.unspentPoints = 3;
    expect(allocatePoints(p, { str: -1 })).not.toBeNull();
    expect(allocatePoints(p, { str: 4 })).not.toBeNull();
    expect(allocatePoints(p, { str: 2, agi: 1 })).toBeNull();
    expect(p.baseAttributes.str).toBe(9);
    expect(p.unspentPoints).toBe(0);
  });
  it('atributos nunca ficam negativos com penalidades de equipamento', () => {
    const p = fresh();
    p.baseAttributes.agi = 0;
    buyItemFree(p, 'scutum');
    const { attrs } = playerCombatStats(p);
    expect(attrs.agi).toBe(0);
  });
});

function buyItemFree(p: ReturnType<typeof fresh>, id: string) {
  p.coins += getItem(id)!.price;
  p.level = Math.max(p.level, getItem(id)!.minLevel);
  expect(buyItem(p, id).ok).toBe(true);
  const uid = p.inventory[p.inventory.length - 1].uid;
  expect(equipItem(p, uid).ok).toBe(true);
}

describe('equipamentos', () => {
  it('todos os itens têm os campos obrigatórios', () => {
    for (const it of ITEMS) {
      expect(it.name && it.description && it.category && it.rarity).toBeTruthy();
      expect(it.price).toBeGreaterThan(0);
    }
    for (const id of ['gladius', 'short_sword', 'trident', 'spear', 'scutum', 'parmula', 'galea', 'light_armor', 'medium_armor', 'greaves'])
      expect(getItem(id)).toBeDefined();
  });
  it('compra, equipa, desequipa e vende', () => {
    const p = fresh();
    const coins = p.coins;
    expect(buyItem(p, 'parmula').ok).toBe(true);
    expect(p.coins).toBe(coins - 60);
    const uid = p.inventory[1].uid;
    const before = playerCombatStats(p).stats.blockPower;
    expect(equipItem(p, uid).ok).toBe(true);
    expect(playerCombatStats(p).stats.blockPower).toBeGreaterThan(before);
    expect(sellItem(p, uid).ok).toBe(false); // equipado
    expect(unequipSlot(p, 'offHand').ok).toBe(true);
    expect(sellItem(p, uid).ok).toBe(true);
    expect(p.coins).toBe(coins - 60 + 24);
  });
  it('bloqueia compra sem moedas ou nível', () => {
    const p = fresh();
    p.coins = 10;
    expect(buyItem(p, 'gladius').ok).toBe(false);
    p.coins = 10000;
    expect(buyItem(p, 'trident').ok).toBe(false); // nível 6
    expect(buyItem(p, 'champion_gladius').ok).toBe(false); // não vendido
  });
});

describe('progressão', () => {
  it('curva de experiência é crescente', () => {
    for (let l = 1; l < MAX_LEVEL - 1; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
    expect(xpToNext(MAX_LEVEL)).toBe(Infinity);
  });
  it('sobe de nível e concede 3 pontos', () => {
    const p = fresh();
    const ups = grantXp(p, xpToNext(1) + xpToNext(2));
    expect(ups).toBe(2);
    expect(p.level).toBe(3);
    expect(p.unspentPoints).toBe(6);
  });
  it('respeita o nível máximo 30', () => {
    const p = fresh();
    grantXp(p, 1e9);
    expect(p.level).toBe(MAX_LEVEL);
  });
  it('vitória dá recompensas, item garantido na primeira vez e desbloqueia o próximo', () => {
    const p = fresh();
    expect(isUnlocked(p, OPPONENTS[1].id)).toBe(false);
    const r = applyBattleResult(p, { opponent: OPPONENTS[0], won: true, reason: 'ko', duration: 60, strategy: 'balanced', rng: createRng(1), now: 5 });
    expect(r.xp).toBeGreaterThan(0);
    expect(r.coins).toBeGreaterThan(0);
    expect(r.itemId).not.toBeNull();
    expect(p.inventory.length).toBe(2);
    expect(isUnlocked(p, OPPONENTS[1].id)).toBe(true);
    expect(p.history[0].result).toBe('win');
    expect(p.stats.wins).toBe(1);
  });
  it('derrota dá pouca experiência e não remove nada', () => {
    const p = fresh();
    const inv = p.inventory.length;
    const r = applyBattleResult(p, { opponent: OPPONENTS[0], won: false, reason: 'ko', duration: 60, strategy: 'balanced', rng: createRng(1) });
    const w = applyBattleResult(fresh(), { opponent: OPPONENTS[0], won: true, reason: 'ko', duration: 60, strategy: 'balanced', rng: createRng(1) });
    expect(r.xp).toBeGreaterThan(0);
    expect(r.xp).toBeLessThan(w.xp);
    expect(p.inventory.length).toBe(inv);
    expect(p.level).toBe(1);
    expect(p.stats.losses).toBe(1);
  });
});

describe('treinamento', () => {
  it('custo progressivo e conversão em atributo', () => {
    const p = fresh();
    p.coins = 10000;
    const c0 = trainingCost(p, 'str');
    for (let i = 0; i < 4; i++) expect(train(p, 'str').ok).toBe(true);
    expect(trainingCost(p, 'str')).toBeGreaterThan(c0);
    expect(p.trainedBonus.str).toBe(1);
    expect(p.training.str.progress).toBe(0);
    expect(playerCombatStats(p).attrs.str).toBe(8);
  });
  it('recusa sem moedas', () => {
    const p = fresh();
    p.coins = 0;
    expect(train(p, 'agi').ok).toBe(false);
  });
});

describe('salvamento', () => {
  it('serializa e recupera o estado completo', () => {
    const p = fresh();
    buyItem(p, 'parmula');
    applyBattleResult(p, { opponent: OPPONENTS[0], won: true, reason: 'ko', duration: 50, strategy: 'aggressive', rng: createRng(3) });
    const r = parseSave(serialize(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.player).toEqual(p);
  });
  it('rejeita dados corrompidos', () => {
    expect(parseSave('{lixo').ok).toBe(false);
    expect(parseSave('{"format":"outro"}').ok).toBe(false);
    expect(parseSave('').ok).toBe(false);
  });
  it('corrige valores adulterados', () => {
    const p = fresh() as unknown as Record<string, unknown>;
    p.level = 999;
    p.coins = -50;
    (p.equipment as Record<string, unknown>).head = 'inexistente';
    const r = parseSave(JSON.stringify({ format: 'colosseum-save', version: 1, savedAt: 0, player: p }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.player.level).toBe(30);
      expect(r.player.coins).toBe(0);
      expect(r.player.equipment.head).toBeNull();
      expect(r.warnings.length).toBeGreaterThan(0);
    }
  });
  it('GameStore salva automaticamente com debounce', async () => {
    const writes: string[] = [];
    const store = new GameStore(
      { read: async () => ({ data: null, source: 'none' }), write: async (d) => (writes.push(d), { ok: true }), writeSync: (d) => (writes.push(d), { ok: true }) },
      10,
    );
    store.setPlayer(fresh());
    store.update((pl) => (pl.coins = 777));
    store.update((pl) => (pl.coins = 778));
    await new Promise((r) => setTimeout(r, 40));
    expect(writes.length).toBe(1);
    const r = parseSave(writes[0]);
    expect(r.ok && r.player.coins).toBe(778);
    store.update((pl) => (pl.coins = 1));
    expect(store.flushSync()).toBe(true);
    expect(writes.length).toBe(2);
  });
});
