// 0.9.1: rivais pela cidade (alguns odeiam o jogador), sem missões
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/renderer/core/systems/PlayerFactory';
import { FRIEND_RESPECT, addRespect, friends, setPartner } from '../../src/renderer/core/systems/DuoSystem';
import { HATERS, RIVAL_HOME, chatWithRival, isHater, rivalsAt } from '../../src/renderer/core/systems/RivalTownSystem';
import { OPPONENTS } from '../../src/renderer/core/data/opponents';

const fresh = () => createPlayer('Maximus', 'gaul', { skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 }, 1000);

describe('rivais pela cidade', () => {
  it('cada rival da escada tem um lugar na cidade e aparece só depois de derrotado', () => {
    for (const o of OPPONENTS) expect(['tavern', 'market', 'ludus', 'temple', 'baths']).toContain(RIVAL_HOME[o.id]);
    const p = fresh();
    expect(rivalsAt(p, 'tavern')).toHaveLength(0);
    p.defeatedOpponents.push('marcus');
    expect(rivalsAt(p, 'tavern').map((o) => o.id)).toEqual(['marcus']);
    expect(rivalsAt(p, 'market')).toHaveLength(0);
  });

  it('conversa: uma por dia, dá respeito e leva à amizade', () => {
    const p = fresh();
    p.defeatedOpponents.push('marcus');
    p.day = 5;
    const r = chatWithRival(p, 'marcus', addRespect);
    expect(r).toEqual({ friend: false });
    expect(chatWithRival(p, 'marcus', addRespect)).toBe('done');
    for (let d = 6; d < 10; d++) {
      p.day = d;
      chatWithRival(p, 'marcus', addRespect);
    }
    expect(p.career.respect.marcus).toBeGreaterThanOrEqual(FRIEND_RESPECT);
    expect(friends(p).map((o) => o.id)).toContain('marcus');
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
