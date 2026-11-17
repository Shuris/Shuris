// Exporta os dados do jogo (TypeScript) para JSON usado pela versão Godot, para que as
// duas versões tenham exatamente os mesmos números e textos. Uso:
//   npx vite-node tools/export-godot.ts
import fs from 'node:fs';
import path from 'node:path';
import { LOCATIONS, WEEKDAYS } from '../src/renderer/core/data/locations';
import { ORIGINS, HAIR_COLORS, CLOTH_COLORS, BASE_ATTRIBUTE, MAX_ATTRIBUTE, POINTS_PER_LEVEL, MAX_LEVEL, ATTRIBUTE_INFO } from '../src/renderer/core/data/gladiators';
import { ITEMS, MAX_PLUS } from '../src/renderer/core/data/equipment';
import { OPPONENTS } from '../src/renderer/core/data/opponents';
import { UPGRADES } from '../src/renderer/core/data/upgrades';
import { PERKS, BRANCHES } from '../src/renderer/core/data/skillTree';
import { SKILLS, STRATEGIES } from '../src/renderer/core/data/skills';
import { ARENAS, PRIVATE_ARENAS } from '../src/renderer/core/data/arenas';
import { CLASSES, POOL } from '../src/renderer/core/data/fighters';
import { PT } from '../src/renderer/i18n/pt';
import * as EN_DATA from '../src/renderer/i18n/data';
import { SKIN_NAMES, HAIR_STYLE_NAMES } from '../src/renderer/core/data/gladiators';
import { EN } from '../src/renderer/i18n/en';
import { createPlayer } from '../src/renderer/core/systems/PlayerFactory';
import { serialize } from '../src/renderer/core/systems/SaveSystem';
import { xpToNext } from '../src/renderer/core/systems/ProgressionSystem';
import { TRAININGS } from '../src/renderer/core/systems/TrainingSystem';
import { RARITY_LABEL, RARITY_COLOR } from '../src/renderer/core/data/equipment';

const out = path.resolve(__dirname, '../../colosseum-godot/data');
fs.mkdirSync(out, { recursive: true });
const write = (name: string, data: unknown) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 1));

write('game_data.json', {
  locations: LOCATIONS,
  weekdays: WEEKDAYS,
  origins: ORIGINS,
  hairColors: HAIR_COLORS,
  clothColors: CLOTH_COLORS,
  attributes: ATTRIBUTE_INFO,
  constants: { BASE_ATTRIBUTE, MAX_ATTRIBUTE, POINTS_PER_LEVEL, MAX_LEVEL, MAX_PLUS },
  xpTable: Array.from({ length: MAX_LEVEL + 1 }, (_, l) => (l >= 1 ? xpToNext(l) : 0)),
  items: ITEMS,
  opponents: OPPONENTS,
  upgrades: UPGRADES,
  perks: PERKS,
  branches: BRANCHES,
  skills: SKILLS,
  strategies: STRATEGIES,
  arenas: [...ARENAS, ...PRIVATE_ARENAS],
  classes: CLASSES,
  pool: POOL,
  trainings: TRAININGS,
  rarityLabel: RARITY_LABEL,
  rarityColor: RARITY_COLOR,
  skinNames: SKIN_NAMES,
  hairNames: HAIR_STYLE_NAMES,
  // nomes em inglês dos dados (na versão TS ficam em i18n/data.ts)
  en: Object.fromEntries(Object.entries(EN_DATA).filter(([k]) => k.startsWith('EN_'))),
});
write('i18n.json', { pt: PT, en: EN });
// save de referência (para o teste de compatibilidade da versão Godot)
const p = createPlayer('Maximus Decimus', 'thracian', { skin: 1, hairStyle: 3, hairColor: 2, beard: true, clothColor: 4 }, 1700000000000);
write('reference_save.json', JSON.parse(serialize(p, 1700000000000)));
// ---- referência para os testes de paridade da versão Godot
{
  const { createRng } = await import('../src/renderer/core/systems/rng');
  const { CombatEngine } = await import('../src/renderer/core/combat/CombatEngine');
  const { opponentCombatant, playerCombatant } = await import('../src/renderer/core/combat/CombatantFactory');
  const { autoPerks } = await import('../src/renderer/core/systems/SkillTreeSystem');
  const r = createRng(12345);
  const rngSeq = Array.from({ length: 20 }, () => r());
  const opps = OPPONENTS.map((o) => {
    const c = opponentCombatant(o);
    return { id: o.id, stats: c.spec.stats, skills: c.spec.skills, perks: autoPerks(o.level, o.paths, true) };
  });
  const pl = createPlayer('Teste', 'gaul', { skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 }, 1);
  pl.level = 8;
  pl.baseAttributes.str += 6; pl.baseAttributes.vit += 4; pl.baseAttributes.agi += 5;
  pl.inventory.push({ uid: 'i2', itemId: 'parmula' }, { uid: 'i3', itemId: 'gladius', plus: 2 } as never);
  pl.equipment.offHand = 'i2'; pl.equipment.mainHand = 'i3';
  pl.perks = ['m1', 'm2', 'd1', 'v1'].filter((id) => PERKS.some((p) => p.id === id));
  const me = playerCombatant(pl);
  const fights = [] as unknown[];
  for (const [i, o] of OPPONENTS.slice(0, 6).entries()) {
    for (const seed of [7, 99, 2024]) {
      const eng = new CombatEngine(me.spec, opponentCombatant(o).spec, { seed: seed + i });
      let evs = 0;
      while (!eng.finished && eng.time < 600) evs += eng.step().length;
      const res = eng.runToEnd();
      fights.push({ opp: o.id, seed: seed + i, winner: res.winner, reason: res.reason, duration: res.duration, hp: [res.fighters[0].hp, res.fighters[1].hp], counters: [res.fighters[0].counters, res.fighters[1].counters], events: evs });
    }
  }
  const W = await import('../src/renderer/core/systems/WeatherSystem');
  const E = await import('../src/renderer/core/systems/EventSystem');
  const V = await import('../src/renderer/core/systems/VenatioSystem');
  const R = await import('../src/renderer/core/systems/RankingSystem');
  const P = await import('../src/renderer/core/systems/ProgressionSystem');
  const T = await import('../src/renderer/core/systems/TournamentSystem');
  const F = await import('../src/renderer/core/data/fighters');
  const I = await import('../src/renderer/core/systems/InviteSystem');
  const D = await import('../src/renderer/core/systems/DuoSystem');
  const seed = 1700000000123;
  const sys: Record<string, unknown> = {};
  sys.weather = Array.from({ length: 40 }, (_, d) => W.weatherOfDay(seed, d + 1).kind);
  sys.merchant = E.merchantDays(seed, 60);
  sys.venatio = Array.from({ length: 60 }, (_, d) => V.isVenatioDay(seed, d + 1));
  sys.stock = E.merchantStock(seed, 9, 6).map((o) => [o.item.id, o.price, o.exotic]);
  const rp = createPlayer('Rank', 'gaul', { skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 }, seed);
  rp.level = 7;
  sys.rankSeed = R.seedRanking(rp);
  for (let d = 2; d <= 6; d++) { rp.day = d; R.nightlyRanking(rp); }
  sys.rankAfter = R.rankTable(rp).map((r) => [r.id, r.level, r.w, r.l, r.pos, r.prev]);
  const rw: unknown[] = [];
  for (const [i, o] of OPPONENTS.slice(0, 5).entries()) {
    for (const mode of ['ladder', 'free', 'rematch', 'beast', 'tournament'] as const) {
      for (const won of [true, false]) rw.push([o.id, mode, won, P.computeRewards(rp, o, won, createRng(31 + i), mode)]);
    }
  }
  sys.rewards = rw;
  const tp = createPlayer('Tour', 'gaul', { skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 }, seed);
  tp.level = 9; tp.day = 13;
  sys.bracket = T.buildBracket(tp);
  sys.challengers = [0, 1, 2, 3].map((i) => { const c = F.freeChallenger(seed, 5, i, 8); return [c.id, c.level]; });
  tp.reputation = 420;
  I.checkInvites(tp);
  sys.invites = tp.career.invites;
  sys.duoFoes = D.duoFoes(tp).map((o) => [o.id, o.level]);
  sys.beast = (() => { const b = createPlayer('B', 'gaul', { skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 }, seed); b.level = 10; b.day = 20; const x = V.beastOfDay(b); return [x.id, x.level]; })();
  write('golden_systems.json', { seed, ...sys });
  write('golden.json', { rngSeq, opps, player: { stats: me.spec.stats, skills: me.spec.skills, perks: pl.perks }, playerSave: pl, fights });
}
console.log('exportado para', out);
