// Versão 0.5: idiomas, melhorias, taverna, jornal com modelos/ilustrações e diálogos.
import { afterEach, describe, expect, it } from 'vitest';
import { PT } from '../../src/renderer/i18n/pt';
import { EN } from '../../src/renderer/i18n/en';
import { getLang, hasKey, setLang, t, tk, variant } from '../../src/renderer/i18n';
import { EN_ARENAS, EN_ITEMS, EN_LOCATIONS, EN_OPPONENTS, EN_ORIGINS, EN_PERKS, itemName, locationName } from '../../src/renderer/i18n/data';
import { ITEMS, getItem } from '../../src/renderer/core/data/equipment';
import { OPPONENTS } from '../../src/renderer/core/data/opponents';
import { PERKS } from '../../src/renderer/core/data/skillTree';
import { LOCATIONS } from '../../src/renderer/core/data/locations';
import { ARENAS } from '../../src/renderer/core/data/arenas';
import { ORIGINS } from '../../src/renderer/core/data/gladiators';
import { UPGRADES, buyUpgrade, canBuyUpgrade, napBonus, trainEnergyCut } from '../../src/renderer/core/data/upgrades';
import { createPlayer } from '../../src/renderer/core/systems/PlayerFactory';
import { TRAIN_ENERGY, NAP_ENERGY, applyTraining, nap, napEnergy, trainEnergy } from '../../src/renderer/core/systems/CalendarSystem';
import { trainingGain } from '../../src/renderer/core/systems/TrainingSystem';
import { canEat, canHearRumor, chat, eat, hearRumor, mealCost, MEAL_ENERGY } from '../../src/renderer/core/systems/TavernSystem';
import { NEWS_TPL, newsBody, newsHeadline, onBattle, publish } from '../../src/renderer/core/systems/NewsSystem';
import { PERSONALITY, npcLine, talk } from '../../src/renderer/core/data/dialogue';
import { parseSave, serialize } from '../../src/renderer/core/systems/SaveSystem';
import { createRng } from '../../src/renderer/core/systems/rng';
import { APPEARANCE } from './helpers';

const fresh = () => createPlayer('Maximus', 'gaul', APPEARANCE, 1000);

afterEach(() => setLang('pt'));

describe('idiomas', () => {
  it('inglês tem todas as chaves do português e nenhuma vazia', () => {
    for (const k of Object.keys(PT)) {
      expect(EN[k as keyof typeof PT], k).toBeTruthy();
      expect((PT as Record<string, string>)[k], k).toBeTruthy();
    }
    expect(Object.keys(EN).length).toBe(Object.keys(PT).length);
  });
  it('parâmetros e variantes são os mesmos nos dois idiomas', () => {
    const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const k of Object.keys(PT)) {
      const pt = (PT as Record<string, string>)[k];
      const en = (EN as Record<string, string>)[k];
      expect(params(en), k).toBe(params(pt));
      expect(en.split('|').length, `${k} (variantes)`).toBe(pt.split('|').length);
    }
  });
  it('todos os dados do jogo têm tradução', () => {
    for (const i of ITEMS) expect(EN_ITEMS[i.id], i.id).toBeTruthy();
    for (const o of OPPONENTS) expect(EN_OPPONENTS[o.id], o.id).toBeTruthy();
    for (const p of PERKS) expect(EN_PERKS[p.id], p.id).toBeTruthy();
    for (const l of LOCATIONS) expect(EN_LOCATIONS[l.id], l.id).toBeTruthy();
    for (const a of ARENAS) expect(EN_ARENAS[a.id], a.id).toBeTruthy();
    for (const o of ORIGINS) expect(EN_ORIGINS[o.id], o.id).toBeTruthy();
  });
  it('troca de idioma muda os textos', () => {
    expect(getLang()).toBe('pt');
    expect(t('arena.fight')).toBe('LUTAR');
    expect(itemName(getItem('gladius')!)).toBe('Gládio');
    setLang('en');
    expect(t('arena.fight')).toBe('FIGHT');
    expect(itemName(getItem('gladius')!)).toBe('Gladius');
    expect(locationName('tavern')).toBe('Tavern');
    expect(t('common.level', { n: 7 })).toBe('Level 7');
  });
  it('variantes e chaves dinâmicas', () => {
    expect(variant('a|b|c', 4)).toBe('b');
    expect(tk('nao.existe', undefined, 'padrão')).toBe('padrão');
    expect(hasKey('np.title')).toBe(true);
  });
});

describe('melhorias do mercado', () => {
  it('cama melhor recupera mais energia no cochilo', () => {
    const p = fresh();
    expect(napEnergy(p)).toBe(NAP_ENERGY);
    p.coins = 2000;
    expect(canBuyUpgrade(p, 'bed_noble')).toBe('level');
    expect(buyUpgrade(p, 'bed_wool')).toBeNull();
    expect(napEnergy(p)).toBe(NAP_ENERGY + 12);
    p.level = 6;
    expect(buyUpgrade(p, 'bed_noble')).toBeNull();
    expect(napBonus(p)).toBe(25); // não acumula com o colchão
    p.energy = 10;
    p.minutes = 9 * 60;
    expect(nap(p)).toBeNull();
    expect(p.energy).toBe(10 + NAP_ENERGY + 25);
    expect(buyUpgrade(p, 'bed_wool')).toBe('owned');
  });
  it('equipamentos do ludus aumentam o ganho do treino certo', () => {
    const p = fresh();
    p.coins = 5000;
    p.level = 10;
    const before = trainingGain(p, 'str');
    buyUpgrade(p, 'stone_weights');
    expect(trainingGain(p, 'str')).toBeGreaterThan(before);
    expect(trainingGain(p, 'agi')).toBe(before);
    buyUpgrade(p, 'doctore');
    expect(trainEnergyCut(p)).toBe(3);
    expect(trainEnergy(p)).toBe(TRAIN_ENERGY - 3);
    p.energy = 100;
    applyTraining(p);
    expect(p.energy).toBe(100 - (TRAIN_ENERGY - 3));
  });
  it('custa moedas e exige nível', () => {
    const p = fresh();
    p.coins = 10;
    expect(canBuyUpgrade(p, 'bed_wool')).toBe('coins');
    expect(UPGRADES.every((u) => hasKey(`upgrade.${u.id}.name`) && hasKey(`upgrade.${u.id}.desc`))).toBe(true);
  });
});

describe('taverna', () => {
  it('refeição recupera energia e custa moedas', () => {
    const p = fresh();
    p.minutes = 12 * 60;
    p.energy = 50;
    const coins = p.coins;
    expect(eat(p)).toBeNull();
    expect(p.energy).toBe(50 + MEAL_ENERGY);
    expect(p.coins).toBe(coins - mealCost(fresh()));
    expect(p.minutes).toBe(12 * 60 + 30);
  });
  it('fecha de manhã cedo', () => {
    const p = fresh();
    p.minutes = 8 * 60;
    p.energy = 50;
    expect(canEat(p)).toMatch(/fechada/);
  });
  it('boatos uma vez por dia, com +1 de fama e uma nota no jornal às vezes', () => {
    const p = fresh();
    p.minutes = 14 * 60;
    const fame = p.reputation;
    const r = hearRumor(p, createRng(3));
    expect(r.error).toBeNull();
    expect(r.rivalId).toBe('marcus');
    expect(p.reputation).toBe(fame + 1);
    expect(canHearRumor(p)).toMatch(/amanhã/);
    expect(tk(`rumor.${r.rivalId}`)).toMatch(/Marcus/);
    expect(chat(p)).toBeNull();
  });
});

describe('Cápua Times', () => {
  it('cada modelo tem texto nos dois idiomas', () => {
    for (const [group, n] of Object.entries(NEWS_TPL)) {
      for (let i = 0; i < n; i++) {
        expect(hasKey(`news.${group}.${i}.h`), `${group}.${i}.h`).toBe(true);
        expect(hasKey(`news.${group}.${i}.b`), `${group}.${i}.b`).toBe(true);
      }
    }
  });
  it('a notícia muda de idioma junto com o jogo', () => {
    const p = fresh();
    const lead = p.news.editions[0].items[0];
    expect(lead.tpl).toBeTruthy();
    expect(lead.img).toBe('newcomer');
    expect(newsBody(lead)).toContain('Maximus');
    const pt = newsHeadline(lead);
    setLang('en');
    expect(newsHeadline(lead)).not.toBe(pt);
    expect(newsBody(lead)).toContain('Maximus');
  });
  it('vitória e derrota viram notícia; às vezes com ilustração', () => {
    let withImage = 0;
    for (let s = 1; s <= 30; s++) {
      const p = fresh();
      onBattle(p, OPPONENTS[0], s % 2 === 0, true, createRng(s));
      const ed = publish(p, createRng(s * 7));
      expect(ed).not.toBeNull();
      if (ed!.items.some((i) => i.img)) withImage++;
      for (const i of ed!.items) if (i.img) expect(hasKey(`news.img.${i.img}`)).toBe(true);
    }
    expect(withImage).toBeGreaterThan(5);
    expect(withImage).toBeLessThan(30);
  });
  it('salvamento guarda modelo, variáveis e ilustração', () => {
    const p = fresh();
    const r = parseSave(serialize(p));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const item = r.player.news.editions[0].items[0];
      expect(item.tpl).toBe(p.news.editions[0].items[0].tpl);
      expect(item.v?.name).toBe('Maximus');
      expect(item.img).toBe('newcomer');
    }
  });
});

describe('personalidade e diálogos', () => {
  it('todo adversário tem falas para todos os momentos, nos dois idiomas', () => {
    for (const o of OPPONENTS) {
      expect(PERSONALITY[o.id], o.id).toBeTruthy();
      for (const m of ['intro', 'win', 'lose', 'hurt', 'crit'] as const) {
        expect(talk(o.id, m, 0), `${o.id}.${m}`).not.toBe('');
        setLang('en');
        expect(talk(o.id, m, 0), `${o.id}.${m} (en)`).not.toBe('');
        setLang('pt');
      }
      expect(hasKey(`rumor.${o.id}`)).toBe(true);
    }
    for (const m of ['reply', 'win', 'lose', 'hurt', 'crit'] as const) expect(talk('player', m, 1, { name: 'Marcus' })).not.toBe('');
  });
  it('moradores falam (monge, ludus, taverna, mercado)', () => {
    for (const who of ['monk', 'trainee', 'instructor', 'doctore', 'keeper', 'keeperServe', 'quintus', 'patron', 'vendor', 'shopper']) {
      expect(npcLine(who, 2), who).not.toBe('');
    }
  });
});

describe('salvamento versão 3', () => {
  it('melhorias, taverna e idioma sobrevivem ao salvar/carregar', () => {
    const p = fresh();
    p.upgrades.push('bed_wool', 'inexistente');
    p.tavern.rumorDay = 4;
    p.settings.language = 'en';
    const r = parseSave(serialize(p));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.player.upgrades).toEqual(['bed_wool']);
      expect(r.player.tavern.rumorDay).toBe(4);
      expect(r.player.settings.language).toBe('en');
    }
  });
  it('save antigo (v2) recebe valores iniciais', () => {
    const p = fresh() as unknown as Record<string, unknown>;
    delete p.upgrades;
    delete p.tavern;
    const r = parseSave(JSON.stringify({ format: 'colosseum-save', version: 2, savedAt: 0, player: p }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.player.upgrades).toEqual([]);
      expect(r.player.tavern).toEqual({ rumorDay: 0, heard: [] });
    }
  });
});

import { avoidOffset } from '../../src/renderer/game/avoid';

describe('balões de fala não ficam sob as janelas', () => {
  const bounds = { left: 0, right: 1600, bottom: 900 };
  it('sem janela por cima, não mexe', () => {
    expect(avoidOffset({ left: 500, top: 400, right: 700, bottom: 440 }, [], bounds)).toEqual({ dx: 0, dy: 0 });
  });
  it('desliza para o lado livre mais próximo (status no canto superior esquerdo)', () => {
    const status = { left: 10, top: 50, right: 330, bottom: 230 };
    const off = avoidOffset({ left: 250, top: 150, right: 450, bottom: 190 }, [status], bounds);
    expect(off.dy).toBe(0);
    expect(250 + off.dx).toBeGreaterThanOrEqual(330);
  });
  it('desvia do painel lateral para a esquerda', () => {
    const side = { left: 1070, top: 40, right: 1600, bottom: 900 };
    const off = avoidOffset({ left: 1000, top: 300, right: 1200, bottom: 340 }, [side], bounds);
    expect(1200 + off.dx).toBeLessThanOrEqual(1070);
  });
  it('entre duas janelas, desce', () => {
    const a = { left: 0, top: 40, right: 600, bottom: 150 };
    const b = { left: 600, top: 40, right: 1600, bottom: 150 };
    const off = avoidOffset({ left: 500, top: 100, right: 700, bottom: 140 }, [a, b], bounds);
    expect(100 + off.dy).toBeGreaterThanOrEqual(150);
  });
});
