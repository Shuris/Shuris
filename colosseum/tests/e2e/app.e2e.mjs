// Teste ponta a ponta do aplicativo Electron real (Playwright).
// Percorre o jogo como um jogador: criação, mapa, mercado, ludus, arena, templo,
// alojamento (dormir), jornal, tela cheia, salvamento. Uso: npm run test:e2e
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'colosseum-e2e-'));
const SAVE = path.join(USER_DATA, 'saves', 'gladiador.json');
const BACKUP = path.join(USER_DATA, 'saves', 'gladiador.backup.json');
const SHOTS = process.env.E2E_SHOTS ? path.resolve(process.env.E2E_SHOTS) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
let app;
let win;
const errors = [];

async function launch() {
  const args = ['.'];
  if (process.getuid?.() === 0 || process.env.CI) args.push('--no-sandbox');
  app = await electron.launch({ args, cwd: ROOT, env: { ...process.env, COLOSSEUM_USER_DATA: USER_DATA } });
  win = await app.firstWindow();
  win.on('pageerror', (e) => errors.push(e.message));
  await win.waitForSelector('#loading', { state: 'detached', timeout: 30000 });
  await win.waitForFunction(() => !!window.__colosseum, null, { timeout: 10000 });
}

async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name} (${Date.now() - t0} ms)`);
  } catch (err) {
    results.push({ name, ok: false, err: err.message });
    console.log(`  ✗ ${name}\n      ${err.message}`);
    if (SHOTS) await win?.screenshot({ path: path.join(SHOTS, `FAIL-${results.length}.png`) }).catch(() => {});
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const state = () => win.evaluate(() => window.__colosseum.store.state);
const winInfo = () =>
  app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return { bounds: w.getBounds(), fullscreen: w.isFullScreen() };
  });
const shot = async (name) => SHOTS && win.screenshot({ path: path.join(SHOTS, `${name}.png`) });

/** Vai até um local pelo mapa (painel do mapa) e espera chegar. */
async function goTo(id) {
  await win.click('[data-nav="map"]');
  await win.click(`[data-action="go"][data-id="${id}"]`);
  await win.waitForFunction((id) => window.__colosseum.store.state.location === id && window.__colosseum.screen === id, id, { timeout: 8000 });
}

async function closeNewspaper() {
  await win.waitForSelector('.newspaper', { timeout: 8000 });
  await win.click('[data-np="close"]');
}

async function fightToEnd() {
  await win.click('.btn-fight');
  await win.waitForSelector('#hud .plate-0', { timeout: 10000 });
  await win.click('[data-hud="speed"][data-v="3"]');
  await win.waitForSelector('.modal-result', { timeout: 150000 });
}

console.log(`COLOSSEUM E2E — dados em ${USER_DATA}`);
await launch();

await step('1. Inicialização (tela de apresentação)', async () => {
  await win.waitForSelector('.title-screen', { timeout: 10000 });
  assert((await win.title()) === 'Colosseum', 'título da janela');
});

await step('2. Criação do gladiador e jornal de estreia', async () => {
  await win.click('[data-i="new"]');
  await win.fill('input[name="gname"]', 'X');
  await win.click('[data-i="next"]');
  assert(((await win.textContent('.form-error')) ?? '').length > 5, 'nome curto rejeitado');
  await win.fill('input[name="gname"]', 'Maximus Decimus');
  await win.click('[data-i="origin"][data-v="thracian"]');
  await win.click('[data-i="beard"][data-v="1"]');
  await win.click('[data-i="next"]');
  await win.click('[data-i="finish"]');
  await closeNewspaper();
  const p = await state();
  assert(p.name === 'Maximus Decimus' && p.baseAttributes.agi === 7, 'dados do gladiador');
  assert(p.location === 'home' && p.day === 1 && p.energy === 100, 'começa no alojamento, dia 1');
  assert(p.news.editions[0].items[0].body.includes('Maximus'), 'manchete com o nome');
  await win.waitForTimeout(600);
  assert(fs.existsSync(SAVE), 'salvamento criado');
});

await step('3. Mapa: viajar leva 20 minutos', async () => {
  const m0 = (await state()).minutes;
  await win.click('[data-nav="map"]');
  await win.waitForFunction(() => window.__colosseum.view.scene === 'map');
  await shot('03-map');
  await win.click('[data-action="go"][data-id="market"]');
  await win.waitForFunction(() => window.__colosseum.store.state.location === 'market', null, { timeout: 8000 });
  assert((await state()).minutes === m0 + 20, 'tempo de viagem');
});

await step('4. Mercado: comprar; Gladiador: equipar e tirar', async () => {
  await win.waitForTimeout(800);
  await shot('04-market');
  await win.click('[data-action="buy"][data-id="parmula"]');
  assert((await state()).coins === 90, 'moedas após compra');
  // mercado fechado à noite e aos domingos: não compra nem vende
  const m0 = (await state()).minutes;
  await win.evaluate(() => window.__colosseum.store.update((p) => (p.minutes = 21 * 60)));
  assert(await win.locator('[data-action="buy"][data-id="greaves"][disabled]').count(), 'compra bloqueada à noite');
  await win.evaluate(() => window.__colosseum.store.update((p) => { p.minutes = 10 * 60; p.day = 7; }));
  assert(await win.locator('[data-action="buy"][data-id="greaves"][disabled]').count(), 'compra bloqueada no domingo');
  assert(((await win.textContent('#statusbar')) ?? '').includes('Domingo'), 'dia da semana visível');
  await win.evaluate((m) => window.__colosseum.store.update((p) => { p.minutes = m; p.day = 1; }), m0);
  await win.click('[data-nav="gladiator"]');
  await win.click('[data-action="tab"][data-id="gear"]');
  await win.click('[data-action="equip"]');
  let p = await state();
  assert(p.inventory.find((i) => i.uid === p.equipment.offHand)?.itemId === 'parmula', 'escudo equipado');
  await win.click('[data-action="unequip"][data-id="offHand"]');
  assert((await state()).equipment.offHand === null, 'desequipar');
  await win.click('[data-action="equip"]');
  p = await state();
  assert(p.equipment.offHand !== null, 'equipar de novo');
});

await step('5. Ludus: treino gasta só energia e 1 hora (sem moedas)', async () => {
  await goTo('ludus');
  const before = await state();
  await win.click('[data-action="train"][data-id="str"]');
  await win.waitForFunction(() => window.__colosseum.store.state.training.str.sessions === 1, null, { timeout: 5000 });
  const after = await state();
  assert(after.coins === before.coins && after.training.str.progress === 25, 'sem moedas, com progresso');
  assert(after.energy === before.energy - 12 && after.minutes === before.minutes + 60, 'energia e tempo');
});

await step('6-9. Arena: luta automática completa, recompensas, energia e horas', async () => {
  await goTo('arena');
  await win.click('[data-action="strategy"][data-id="aggressive"]');
  const before = await state();
  await win.click('.btn-fight');
  await win.waitForSelector('#hud .plate-0', { timeout: 10000 });
  await win.waitForTimeout(5000);
  await shot('06-battle');
  const a = await win.evaluate(() => ({ started: window.__colosseum.view.arena.engine.started, arena: window.__colosseum.view.arena.arenaDef.id, sfx: window.__colosseum.sound.played }));
  assert(a.started && a.arena === 'capua', 'luta iniciada na Arena de Cápua');
  assert(a.sfx > 3, 'efeitos sonoros tocando');
  await win.click('[data-hud="speed"][data-v="3"]');
  await win.waitForSelector('.modal-result', { timeout: 150000 });
  const after = await state();
  const h = after.history[0];
  assert(after.stats.battles === 1 && h, 'luta registrada');
  assert(after.coins === before.coins + h.coins, 'moedas recebidas');
  assert(after.energy === before.energy - 35 && after.minutes === before.minutes + 120, 'energia e 2 horas');
  console.log(`      resultado: ${h.result} (${h.reason}) em ${h.duration}s, +${h.xp} XP, +${h.coins} moedas`);
  await win.click('[data-r="close"]');
});

await step('10. Sem energia não luta; dormir inicia o dia seguinte com o jornal', async () => {
  await win.evaluate(() => window.__colosseum.store.update((p) => (p.energy = 10)));
  assert(await win.locator('.btn-fight[disabled]').count(), 'botão de luta desativado sem energia');
  await goTo('home');
  const before = await state();
  await win.click('[data-action="sleep"]');
  await win.waitForFunction((d) => window.__colosseum.store.state.day === d + 1, before.day, { timeout: 6000 });
  const p = await state();
  assert(p.energy === 100 && p.minutes === 7 * 60, 'energia cheia às 7h');
  assert(p.news.editions[0].day === p.day, 'nova edição publicada');
  if (p.news.editions[0].items.some((n) => n.kind !== 'city')) await closeNewspaper();
  await shot('10-new-day');
});

await step('11. Derrota (desistência) não tira nada', async () => {
  await goTo('arena');
  const before = await state();
  await win.click('.btn-fight');
  await win.waitForSelector('#hud [data-hud="forfeit"]');
  await win.waitForTimeout(4000);
  await win.click('[data-hud="forfeit"]');
  await win.click('.modal [data-a="ok"]');
  await win.waitForSelector('.modal-result', { timeout: 15000 });
  const after = await state();
  assert(after.history[0].result === 'loss' && after.inventory.length === before.inventory.length, 'derrota sem perdas');
  await win.click('[data-r="close"]');
});

await step('12. Subir de nível: pontos de atributo e de habilidade', async () => {
  await win.evaluate(() => window.__colosseum.store.update((p) => (p.xp += 1000)));
  await goTo('ludus');
  await win.click('[data-action="train"][data-id="agi"]');
  await win.waitForFunction(() => window.__colosseum.store.state.level > 1, null, { timeout: 5000 });
  const p = await state();
  assert(p.unspentPoints === (p.level - 1) * 3, 'pontos de atributo');
  assert(p.skillPoints === 1 + p.level, 'pontos de habilidade');
  await win.click('[data-nav="gladiator"]');
  await win.click('[data-action="tab"][data-id="attrs"]');
  const str0 = p.baseAttributes.str;
  await win.click('[data-action="plus"][data-id="str"]');
  await win.click('[data-action="confirm"]');
  assert((await state()).baseAttributes.str === str0 + 1, 'distribuição aplicada');
});

await step('13. Templo: árvore de habilidades', async () => {
  await goTo('temple');
  await win.click('[data-action="select"][data-id="m2"]');
  assert(await win.locator('[data-action="learn"][disabled]').count(), 'pré-requisito bloqueia');
  await win.click('[data-action="select"][data-id="m1"]');
  await win.click('[data-action="learn"]');
  await win.click('[data-action="select"][data-id="m2"]');
  await win.click('[data-action="learn"]');
  const p = await state();
  assert(p.perks.includes('m1') && p.perks.includes('m2'), 'habilidades aprendidas');
  assert(((await win.textContent('#panel')) ?? '').includes('Monge Aurelius'), 'monge presente');
  await shot('13-temple');
});

await step('15. Arena certa a cada dois adversários', async () => {
  // libera Rufus e dá fama suficiente para virar manchete após a próxima luta
  // escolhe um dia sem chuva (a etapa seguinte verifica o céu limpo de dia)
  await win.evaluate(() => {
    const app = window.__colosseum;
    let d = app.store.state.day;
    while (app.weatherOfDay(d).rainy) d++;
    app.store.update((p) => { p.day = d; p.defeatedOpponents = ['marcus', 'cassius']; p.selectedOpponent = 'rufus'; p.energy = 100; p.minutes = 9 * 60; p.reputation += 30; });
  });
  await goTo('arena');
  await win.click('.btn-fight');
  await win.waitForSelector('#hud .plate-0', { timeout: 10000 });
  const id = await win.evaluate(() => window.__colosseum.view.arena.arenaDef.id);
  assert(id === 'pompeii', `Rufus em Pompeia (${id})`);
  await win.waitForTimeout(2000);
  await shot('15-pompeii');
});

await step('16. Dia e noite seguem o relógio do jogo', async () => {
  const sample = (minutes) =>
    win.evaluate(async (m) => {
      window.__colosseum.store.update((p) => (p.minutes = m));
      await new Promise((r) => setTimeout(r, 2500));
      const s = window.__colosseum.view.sky;
      return { light: s.state.light, ambient: s.state.ambient };
    }, minutes);
  const night = await sample(23 * 60);
  const day = await sample(12 * 60);
  assert(day.light > 0.9 && day.ambient === 0xffffff, `dia claro (${JSON.stringify(day)})`);
  assert(night.light < 0.3, `noite escura (${JSON.stringify(night)})`);
  await win.waitForSelector('.modal-result', { timeout: 150000 });
  await win.click('[data-r="close"]');
});

await step('14. Jornal: a fama vira manchete na manhã seguinte, citando o rival', async () => {
  const pending = (await state()).news.pending;
  assert(pending.some((n) => n.kind === 'fame'), 'notícia de fama gerada após a luta');
  await goTo('home');
  await win.click('[data-action="sleep"]');
  await closeNewspaper();
  const ed = (await state()).news.editions[0];
  const fame = ed.items.find((n) => n.kind === 'fame');
  assert(fame && (fame.headline + fame.body).includes('Maximus'), 'manchete com o nome');
  assert((fame.headline + fame.body).includes('Rufus') || (fame.headline + fame.body).includes('Brutus'), `cita o rival: ${fame.body}`);
  await goTo('forum');
  await win.click('[data-action="read"]');
  await win.waitForSelector('.newspaper');
  await shot('14-newspaper');
  await win.click('[data-np="close"]');
});

await step('21. Chuva: céu fechado e gotas caindo', async () => {
  const rainy = await win.evaluate(() => {
    for (let d = 2; d < 120; d++) {
      const w = window.__colosseum.weatherOfDay(d);
      if (w.rainy) return { day: d, mid: Math.round((w.start + w.end) / 2) };
    }
    return null;
  });
  assert(rainy, 'existe dia chuvoso');
  const before = await state();
  await win.evaluate((r) => window.__colosseum.store.update((p) => { p.day = r.day; p.minutes = r.mid; }), rainy);
  await win.waitForTimeout(2500);
  const w = await win.evaluate(() => {
    const sky = window.__colosseum.view.sky;
    return { rain: sky.weather.rain, cloud: sky.weather.cloud, light: sky.state.light, status: document.getElementById('statusbar').textContent };
  });
  assert(w.rain > 0.9 && w.cloud > 0.9, `chovendo (${JSON.stringify(w)})`);
  assert(w.status.includes('Chuva'), 'status mostra chuva');
  await shot('21-rain');
  await win.evaluate((b) => window.__colosseum.store.update((p) => { p.day = b.day; p.minutes = b.minutes; }), before);
});

await step('17. Tela cheia (ativar e sair)', async () => {
  await win.click('[data-w="fullscreen"]');
  await win.waitForTimeout(1200);
  assert((await winInfo()).fullscreen, 'tela cheia ativa');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(1200);
  assert(!(await winInfo()).fullscreen, 'saiu da tela cheia');
});

await step('18. Redimensionamento da janela', async () => {
  for (const [w, h] of [
    [980, 620],
    [1400, 880],
  ]) {
    await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setSize(w, h), [w, h]);
    await win.waitForTimeout(700);
    const c = await win.evaluate(() => ({ cw: document.querySelector('#game canvas').clientWidth, iw: window.innerWidth }));
    assert(Math.abs(c.cw - c.iw) <= 2, `canvas acompanha a janela (${JSON.stringify(c)})`);
  }
});

const snapshot = await state();

await step('19. Salvamento, fechamento e reabertura', async () => {
  await win.waitForTimeout(800);
  await app.close();
  await launch();
  await win.waitForSelector('#panel .panel-head', { timeout: 10000 });
  const p = await state();
  for (const k of ['name', 'level', 'xp', 'coins', 'reputation', 'day', 'minutes', 'energy', 'location', 'skillPoints'])
    assert(JSON.stringify(p[k]) === JSON.stringify(snapshot[k]), `campo ${k} recuperado`);
  for (const k of ['baseAttributes', 'equipment', 'perks', 'training'])
    assert(JSON.stringify(p[k]) === JSON.stringify(snapshot[k]), `campo ${k} recuperado`);
  assert(p.history.length === snapshot.history.length && p.news.editions.length === snapshot.news.editions.length, 'histórico e jornal');
});

await step('20. Recuperação de salvamento corrompido via backup', async () => {
  await app.close();
  assert(fs.existsSync(BACKUP), 'backup existe');
  fs.writeFileSync(SAVE, '{ corrompido');
  await launch();
  await win.waitForSelector('#panel .panel-head', { timeout: 10000 });
  assert((await state()).name === snapshot.name, 'recuperado do backup');
});

await app.close();
const failed = results.filter((r) => !r.ok);
if (errors.length) console.log(`\nErros de página capturados:\n  ${errors.join('\n  ')}`);
console.log(`\n${results.length - failed.length}/${results.length} etapas aprovadas.`);
fs.rmSync(USER_DATA, { recursive: true, force: true });
process.exit(failed.length || errors.length ? 1 : 0);
