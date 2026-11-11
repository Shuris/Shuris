// Capturas rápidas para conferência visual (não faz parte da suíte). Uso:
// xvfb-run -a -s "-screen 0 1600x1000x24" node tests/e2e/visual.mjs <pasta> <cenas...>
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.resolve(process.argv[2] ?? 'shots');
const WANT = new Set(process.argv.slice(3));
fs.mkdirSync(OUT, { recursive: true });
const USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'colosseum-vis-'));
const args = ['.'];
if (process.getuid?.() === 0) args.push('--no-sandbox');
const app = await electron.launch({ args, cwd: ROOT, env: { ...process.env, COLOSSEUM_USER_DATA: USER_DATA } });
const win = await app.firstWindow();
win.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await win.waitForSelector('#loading', { state: 'detached', timeout: 30000 });
await win.waitForFunction(() => !!window.__colosseum, null, { timeout: 10000 });
const shot = (n) => win.screenshot({ path: path.join(OUT, `${n}.png`) });
const want = (n) => !WANT.size || WANT.has(n);
await shot('title');
await win.click('#title [data-ts="slots-new"]');
await win.click('#title .title-slots [data-ts="play"][data-slot="1"]');
await win.click('[data-i="new"]');
await win.fill('input[name="gname"]', 'Maximus Decimus');
await win.click('[data-i="next"]');
await win.click('[data-i="finish"]');
await win.waitForSelector('.newspaper', { timeout: 8000 });
await win.click('[data-np="close"]');
const goTo = async (id) => {
  await win.click('[data-nav="map"]');
  await win.click(`[data-action="go"][data-id="${id}"]`);
  await win.waitForFunction((id) => window.__colosseum.store.state.location === id, id, { timeout: 8000 });
  await win.waitForTimeout(1500);
};
const set = (fn, a) => win.evaluate(fn, a);
const findDay = (pred) =>
  win.evaluate((src) => {
    const f = new Function('w', 'd', `return ${src}`);
    for (let d = 3; d < 200; d++) if (f(window.__colosseum.weatherOfDay(d), d)) return d;
    return 0;
  }, pred);
await set(() => window.__colosseum.store.update((p) => { p.level = 12; p.defeatedOpponents = ['marcus', 'cassius', 'brutus', 'crixus', 'rufus', 'spiculus']; p.minutes = 14 * 60; }));
for (const id of ['tavern', 'market', 'ludus', 'temple', 'baths', 'forum']) {
  if (!want(id)) continue;
  await goTo(id);
  await shot(`loc-${id}`);
}
if (want('battle') || want('rain')) {
  const rainy = await findDay('w.rainy && w.start <= 700 && w.end >= 760 && d % 7 !== 6 && d % 7 !== 0');
  if (want('rain')) {
    const mid = 730;
    await set((a) => window.__colosseum.store.update((p) => { p.day = a.d; p.minutes = a.m; p.energy = 100; p.defeatedOpponents = []; p.selectedOpponent = 'marcus'; }), { d: rainy, m: mid });
  } else await set(() => window.__colosseum.store.update((p) => { p.minutes = 10 * 60; p.energy = 100; p.defeatedOpponents = []; p.selectedOpponent = 'marcus'; }));
  await goTo('arena');
  await win.click('[data-action="tab"][data-id="fights"]').catch(() => {});
  if (await win.locator('[data-action="fight"][disabled]').count()) console.log('PANEL', (await win.innerText('#panel')).slice(0, 600));
  await win.click('[data-action="fight"]', { timeout: 3000 });
  for (const ms of [800, 2500, 5000, 9000]) {
    await win.waitForTimeout(ms - (ms > 800 ? [800, 2500, 5000, 9000][[800, 2500, 5000, 9000].indexOf(ms) - 1] : 0));
    await shot(`${want('rain') ? 'rain' : 'battle'}-${ms}`);
  }
}
if (want('rivalclick')) {
  await goTo('tavern');
  const r = await win.evaluate(() => {
    const hub = window.__colosseum.view.game.scene.getScene('hub');
    const i = hub.talkers.findIndex((t) => t.rivalId);
    const first = i >= 0 && (hub.clickTalker(i), window.__colosseum.store.state.career.respect.marcus);
    return { i, first, names: hub.talkers.filter((t) => t.rivalId).map((t) => t.rivalId) };
  });
  console.log('RIVAL', JSON.stringify(r));
  await win.waitForTimeout(500);
  await shot('rival-click');
}
if (want('gear')) {
  await win.click('[data-nav="gladiator"]');
  await win.click('[data-action="tab"][data-id="gear"]');
  await win.waitForTimeout(1200);
  await shot('gear');
  await win.click('[data-nav="gladiator"]');
}
if (want('climate')) {
  const day = await win.evaluate(() => {
    for (let d = 21; d < 400; d++) if (Math.floor((d - 1) / 10) % 4 === 2 && d % 14 === 10) return d;
    return 21;
  });
  await set((d) => window.__colosseum.store.update((p) => { p.day = d; p.minutes = 7 * 60; }), day);
  await goTo('forum');
  await win.waitForTimeout(1500);
  await shot('climate-forum');
  await win.click('[data-nav="map"]');
  await win.waitForTimeout(1500);
  await shot('climate-map');
}
await app.close();
