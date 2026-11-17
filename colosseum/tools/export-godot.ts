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
  skinNames: SKIN_NAMES,
  hairNames: HAIR_STYLE_NAMES,
  // nomes em inglês dos dados (na versão TS ficam em i18n/data.ts)
  en: Object.fromEntries(Object.entries(EN_DATA).filter(([k]) => k.startsWith('EN_'))),
});
write('i18n.json', { pt: PT, en: EN });
// save de referência (para o teste de compatibilidade da versão Godot)
const p = createPlayer('Maximus Decimus', 'thracian', { skin: 1, hairStyle: 3, hairColor: 2, beard: true, clothColor: 4 }, 1700000000000);
write('reference_save.json', JSON.parse(serialize(p, 1700000000000)));
console.log('exportado para', out);
