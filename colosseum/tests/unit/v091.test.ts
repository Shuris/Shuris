// 0.9.1: rivais pela cidade (alguns odeiam o jogador), sem missões
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/renderer/core/systems/PlayerFactory';
import { FRIEND_RESPECT, addRespect, friends, setPartner } from '../../src/renderer/core/systems/DuoSystem';
import { CHAT_MAX, CHAT_MIN, HATERS, RIVAL_HOME, chatWithRival, isHater, rivalsAt } from '../../src/renderer/core/systems/RivalTownSystem';
import { OPPONENTS } from '../../src/renderer/core/data/opponents';

const fresh = () => createPlayer('Maximus', 'gaul', { skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 }, 1000);

describe('rivais pela cidade', () => {
  it('cada rival tem um lugar na cidade; aparece depois de derrotado e só se respeitar o jogador', () => {
    for (const o of OPPONENTS) expect(['tavern', 'market', 'ludus', 'temple', 'baths']).toContain(RIVAL_HOME[o.id]);
    const p = fresh();
    expect(rivalsAt(p, 'tavern')).toHaveLength(0);
    p.defeatedOpponents.push('marcus', 'crixus');
    // Crixus (taverna) odeia o jogador: não aparece
    expect(rivalsAt(p, 'tavern').map((o) => o.id)).toEqual(['marcus']);
    expect(rivalsAt(p, 'market')).toHaveLength(0);
  });

  it('um clique por dia em cada rival: +10 a 15 de amizade; com 100 vira amigo', () => {
    const p = fresh();
    p.defeatedOpponents.push('marcus', 'cassius');
    p.day = 5;
    const r = chatWithRival(p, 'marcus', addRespect);
    expect(typeof r).toBe('object');
    const gain = (r as { gain: number }).gain;
    expect(gain).toBeGreaterThanOrEqual(CHAT_MIN);
    expect(gain).toBeLessThanOrEqual(CHAT_MAX);
    expect(p.career.respect.marcus).toBe(gain);
    expect(chatWithRival(p, 'marcus', addRespect)).toBe('done'); // de novo no mesmo dia
    expect(typeof chatWithRival(p, 'cassius', addRespect)).toBe('object'); // outro rival, mesmo dia
    let d = 6;
    while ((p.career.respect.marcus ?? 0) < FRIEND_RESPECT && d < 30) {
      p.day = d++;
      chatWithRival(p, 'marcus', addRespect);
    }
    expect(FRIEND_RESPECT).toBe(100);
    expect(friends(p).map((o) => o.id)).toContain('marcus');
    expect(friends(p).map((o) => o.id)).not.toContain('cassius');
  });

  it('quem odeia o jogador nunca vira amigo nem parceiro', () => {
    expect(HATERS.size).toBeGreaterThan(0);
    const hater = [...HATERS][0];
    expect(isHater(hater)).toBe(true);
    const p = fresh();
    p.defeatedOpponents.push(hater);
    p.day = 3;
    expect(chatWithRival(p, hater, addRespect)).toBe('hate');
    expect(addRespect(p, hater, 100)).toBe(false);
    p.career.respect[hater] = 100; // save antigo com respeito alto
    expect(friends(p).some((o) => o.id === hater)).toBe(false);
    expect(setPartner(p, hater)).toBe(false);
    expect(OPPONENTS.filter((o) => !isHater(o.id)).length).toBeGreaterThan(HATERS.size);
  });

  it('o dia de conversa com cada rival sobrevive ao salvar', async () => {
    const { parseSave, serialize } = await import('../../src/renderer/core/systems/SaveSystem');
    const p = fresh();
    p.defeatedOpponents.push('marcus');
    p.day = 4;
    chatWithRival(p, 'marcus', addRespect);
    const back = parseSave(serialize(p));
    expect(back.ok && back.player.career.chatDays.marcus).toBe(4);
  });
});

describe('falas dos rivais', () => {
  it('citam o nome do jogador (sem sobrar {name})', async () => {
    const { npcLine } = await import('../../src/renderer/core/data/dialogue');
    for (const id of Object.keys(RIVAL_HOME)) {
      for (let k = 0; k < 8; k++) {
        const line = npcLine(`rival.${id}`, k, { name: 'Maximus' });
        expect(line.length).toBeGreaterThan(0);
        expect(line).not.toContain('{');
      }
    }
  });
});
