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
const SAVE = path.join(USER_DATA, 'saves', 'slot1.json');
const BACKUP = path.join(USER_DATA, 'saves', 'slot1.backup.json');
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
    // uma etapa anterior que falhou pode ter deixado uma janela aberta
    if (win && !win.isClosed()) await win.evaluate(() => document.querySelector('.modal-result [data-r="close"]')?.click()).catch(() => {});
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

/** Abre o menu de pausa (Esc) e as opções. */
async function openOptions() {
  await win.keyboard.press('Escape');
  await win.waitForSelector('.modal-pause');
  await win.click('[data-p="options"]');
  await win.waitForSelector('[data-o="lang-en"]');
}

/** Continua o gladiador de um espaço do menu principal. */
async function playSlot(n) {
  await win.waitForSelector(`#title [data-ts="play"][data-slot="${n}"]`, { timeout: 10000 });
  await win.click(`#title [data-ts="play"][data-slot="${n}"]`);
}

/** Desiste da luta atual (rápido) e espera o fim. */
async function forfeitNow() {
  await win.waitForSelector('#hud [data-hud="forfeit"]', { timeout: 10000 });
  await win.waitForTimeout(3000);
  await win.click('[data-hud="forfeit"]');
  await win.click('.modal [data-a="ok"]');
}

async function fightToEnd() {
  await win.click('.btn-fight');
  await win.waitForSelector('#hud .plate-0', { timeout: 10000 });
  await win.click('[data-hud="speed"][data-v="3"]');
  await win.waitForSelector('.modal-result', { timeout: 150000 });
}

console.log(`COLOSSEUM E2E — dados em ${USER_DATA}`);
await launch();

await step('1. Inicialização: tela cheia e menu principal com 3 espaços de save', async () => {
  await win.waitForSelector('#title .slot-card', { timeout: 10000 });
  assert((await win.title()) === 'Colosseum', 'título da janela');
  assert((await win.locator('#title .slot-card').count()) === 3, 'três espaços de salvamento');
  assert((await win.locator('#titlebar').count()) === 0, 'sem barra de opções em cima do jogo');
  await win.waitForTimeout(1200);
  assert((await winInfo()).fullscreen, 'abre em tela cheia');
  assert((await win.evaluate(() => window.__colosseum.music.track)) === 'menu', 'música do menu');
  await shot('01-title');
  await playSlot(1);
  await win.waitForSelector('.title-screen', { timeout: 10000 });
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
  assert(p.news.editions[0].items[0].img === 'newcomer', 'estreia com ilustração');
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
  await win.evaluate(() => window.__colosseum.store.update((p) => (p.injury = null)));
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
  assert(after.injury && after.injury.days === 1, 'desistência deixa ferido por 1 dia');
  assert(await win.locator('.modal-result .injury-note').count(), 'ferimento avisado no resultado');
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
  // dia seco: na chuva o monge medita lá dentro
  await win.evaluate(() => {
    const app = window.__colosseum;
    let d = app.store.state.day;
    while (app.weatherOfDay(d).rainy) d++;
    app.store.update((p) => { p.day = d; p.minutes = 10 * 60; });
  });
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
  const pos = await win.evaluate(() => {
    const hub = window.__colosseum.view.game.scene.getScene('hub');
    return { monk: hub.monk.x, hero: hub.hero.x };
  });
  assert(pos.monk > pos.hero, `monge à direita do gladiador (${JSON.stringify(pos)})`);
  await shot('13-temple');
});

await step('15. Arena certa a cada dois adversários', async () => {
  // libera Rufus e dá fama suficiente para virar manchete após a próxima luta
  // escolhe um dia sem chuva (a etapa seguinte verifica o céu limpo de dia)
  await win.evaluate(() => {
    const app = window.__colosseum;
    let d = app.store.state.day;
    while (app.weatherOfDay(d).rainy) d++;
    app.store.update((p) => { p.day = d; p.defeatedOpponents = ['marcus', 'cassius']; p.selectedOpponent = 'rufus'; p.energy = 100; p.minutes = 9 * 60; p.reputation += 30; p.injury = null; });
  });
  await goTo('arena');
  await win.click('.btn-fight');
  await win.waitForSelector('#hud .plate-0', { timeout: 10000 });
  const id = await win.evaluate(() => window.__colosseum.view.arena.arenaDef.id);
  assert(id === 'pompeii', `Rufus em Pompeia (${id})`);
  await win.waitForTimeout(2000);
  const arena = await win.evaluate(() => {
    const sc = window.__colosseum.view.arena;
    return { scale: sc.views[0].scaleY, bubbles: sc.children.list.filter((o) => o.depth === 1200).length };
  });
  assert(Math.abs(arena.scale - 1.3) < 0.01, `lutadores 30% maiores (${arena.scale})`);
  assert(arena.bubbles >= 1, 'provocação do adversário em balão de fala');
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
  const cine = await win.evaluate(() => {
    const a = window.__colosseum.view.arena;
    return { standing: a.standing, music: window.__colosseum.music.track, finale: !!a.finale, finaleOn: a.finaleOn, reason: a.engine.result?.reason, blood: a.bloodGround.commandBuffer.length };
  });
  assert(cine.standing === 1, 'público de pé no fim da luta');
  if (cine.reason === 'ko') assert(cine.finale && cine.finaleOn, `golpe final previsto e mostrado em câmera lenta (${JSON.stringify(cine)})`);
  assert(cine.blood > 0, 'sangue na areia');
  assert(cine.music === 'arena', 'música da arena');
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
  // na chuva ninguém fica ao ar livre: ludus vazio e mercado só com os vendedores
  await goTo('ludus');
  await win.evaluate((r) => window.__colosseum.store.update((p) => { p.day = r.day; p.minutes = r.mid; }), rainy);
  await win.waitForTimeout(2500);
  const ludusNpcs = await win.evaluate(() => window.__colosseum.view.game.scene.getScene('hub').npcs.length);
  assert(ludusNpcs === 0, `ludus vazio na chuva (${ludusNpcs})`);
  await win.evaluate((b) => window.__colosseum.store.update((p) => { p.day = b.day; p.minutes = b.minutes; }), before);
});

await step('17. Esc pausa o jogo; F11 alterna tela cheia', async () => {
  await win.keyboard.press('Escape');
  await win.waitForSelector('.modal-pause');
  const paused = await win.evaluate(() => window.__colosseum.view.game.scene.isPaused('hub'));
  assert(paused, 'cena pausada');
  await shot('17-pause');
  await win.click('[data-p="resume"]');
  assert(!(await win.evaluate(() => window.__colosseum.view.game.scene.isPaused('hub'))), 'jogo retomado');
  await win.keyboard.press('F11');
  await win.waitForTimeout(1500);
  assert(!(await winInfo()).fullscreen, 'F11 sai da tela cheia');
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

await step('22. Melhorias do mercado: cama e equipamentos do ludus', async () => {
  await win.evaluate(() => {
    const app = window.__colosseum;
    let d = app.store.state.day;
    while (d % 7 === 0 || app.weatherOfDay(d).rainy) d++;
    app.store.update((p) => { p.coins += 1000; p.minutes = 10 * 60; p.energy = 60; p.day = d; });
  });
  await goTo('market');
  await win.click('[data-action="tab"][data-id="upgrades"]');
  await win.click('[data-action="upgrade"][data-id="bed_wool"]');
  await win.click('[data-action="upgrade"][data-id="stone_weights"]');
  const p = await state();
  assert(p.upgrades.includes('bed_wool') && p.upgrades.includes('stone_weights'), `melhorias compradas (${p.upgrades})`);
  await goTo('ludus');
  await win.waitForTimeout(1500);
  const lud = await win.evaluate(() => {
    const hub = window.__colosseum.view.game.scene.getScene('hub');
    return { npcs: hub.npcs.length, weights: hub.children.list.some((o) => o.texture && o.texture.key === 'fx:up_weights') };
  });
  assert(lud.npcs >= 4, `outros gladiadores treinando (${lud.npcs})`);
  assert(lud.weights, 'pesos de pedra aparecem no ludus');
  assert(((await win.textContent('#panel')) ?? '').includes('equipamento +35%'), 'bônus de treino indicado');
  await shot('22-ludus');
  await goTo('home');
  assert(((await win.textContent('#panel')) ?? '').includes('+32 energia'), 'cochilo melhor com o colchão de lã');
});

await step('23. Taverna: comer, ouvir boatos e clicar nos fregueses', async () => {
  await win.evaluate(() => window.__colosseum.store.update((p) => { p.minutes = 14 * 60; p.energy = 50; }));
  await goTo('tavern');
  const before = await state();
  await win.click('[data-action="eat"]');
  let p = await state();
  assert(p.energy === before.energy + 15 && p.coins < before.coins, 'refeição recupera energia');
  await win.click('[data-action="rumor"]');
  p = await state();
  assert(p.reputation === before.reputation + 1 && p.tavern.rumorDay === p.day, 'boato ouvido (+1 fama)');
  assert(await win.locator('[data-action="rumor"][disabled]').count(), 'boato só 1x por dia');
  assert(!(await win.locator('[data-action="talk"]').count()), 'sem a ação inútil de "conversar"');
  // os fregueses falam quando clicados (destaque ao passar o mouse)
  const pt = await win.evaluate(() => {
    const h = window.__colosseum.view.game.scene.getScene('hub');
    const cam = h.cameras.main;
    const v = h.npcs[1].v;
    const r = document.querySelector('#game canvas').getBoundingClientRect();
    return { x: r.left + (v.x - cam.worldView.x) * cam.zoom, y: r.top + (v.y - 25 - cam.worldView.y) * cam.zoom };
  });
  await win.mouse.move(pt.x, pt.y);
  await win.waitForTimeout(250);
  await win.mouse.down();
  await win.mouse.up();
  await win.waitForTimeout(600);
  const bubbles = await win.evaluate(() => window.__colosseum.view.game.scene.getScene('hub').children.list.filter((o) => o.depth === 1200).length);
  assert(bubbles >= 1, 'freguês clicado fala em balão');
  const overlap = await win.evaluate(() => {
    const h = window.__colosseum.view.game.scene.getScene('hub');
    return h.npcs.filter((n) => h.blocked(n.v.x, n.v.y, 0)).length;
  });
  assert(overlap === 0, `ninguém dentro dos móveis (${overlap})`);
  await shot('23-tavern');
});

await step('24. Idioma: inglês e português (pelas opções do menu de pausa)', async () => {
  await openOptions();
  await win.click('[data-o="lang-en"]');
  await win.waitForTimeout(400);
  await win.keyboard.press('Escape'); // fecha as opções e volta à pausa
  await win.waitForSelector('.modal-pause');
  await win.keyboard.press('Escape'); // retoma o jogo
  await win.waitForTimeout(300);
  assert((await win.textContent('[data-nav="map"]')) === 'Map', 'abas em inglês');
  assert(((await win.textContent('#panel')) ?? '').includes('The Boar Tavern'), 'painel em inglês');
  assert(((await win.textContent('#statusbar')) ?? '').match(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/), 'dia da semana em inglês');
  assert((await state()).settings.language === 'en', 'idioma salvo');
  await shot('24-english');
  await win.evaluate(() => window.__colosseum.changeLang('pt'));
  await win.waitForTimeout(400);
  assert((await win.textContent('[data-nav="map"]')) === 'Mapa', 'de volta ao português');
});

await step('25. Festival: arquibancada lotada e fama em dobro', async () => {
  await win.evaluate(() => window.__colosseum.store.update((p) => { p.day = 10; p.minutes = 9 * 60; p.energy = 100; p.injury = null; }));
  await goTo('arena');
  assert(((await win.textContent('#panel')) ?? '').includes('festival'), 'aviso de festival na arena');
  await win.click('[data-action="fight-free"]');
  await win.waitForSelector('#hud .plate-0', { timeout: 10000 });
  await win.waitForTimeout(2500);
  const fest = await win.evaluate(() => {
    const sc = window.__colosseum.view.arena;
    return { crowd: sc.crowd.texture.key, deco: sc.children.list.some((o) => o.texture && o.texture.key === 'fx:festival') };
  });
  assert(fest.crowd === 'bg:crowdfest_' + (await win.evaluate(() => window.__colosseum.view.arena.arenaDef.id)) && fest.deco, `arena enfeitada e lotada (${JSON.stringify(fest)})`);
  await shot('25-festival');
  await win.click('[data-hud="speed"][data-v="3"]');
  await win.waitForSelector('.modal-result', { timeout: 150000 });
  const p = await state();
  if (p.history[0].result === 'win') assert(await win.locator('.unlock.festival').count(), 'fama em dobro indicada');
  assert(p.events.freeCount === 1, 'desafiante avulso contado');
  await win.click('[data-r="close"]');
});

await step('26. Rivais: derrotado só luta de novo se pedir revanche', async () => {
  await win.evaluate(() => window.__colosseum.store.update((p) => { p.day = 12; p.minutes = 9 * 60; p.energy = 100; p.injury = null; p.selectedOpponent = 'marcus'; p.rematch = null; }));
  await goTo('arena');
  assert(await win.locator('.btn-fight[disabled]').count(), 'luta contra derrotado bloqueada');
  await win.evaluate(() => window.__colosseum.store.update((p) => { p.rematch = { opponentId: 'marcus', askedDay: 11, expires: 18 }; }));
  await win.waitForSelector('.rematch-card');
  const losses0 = (await state()).rivals.marcus?.losses ?? 0;
  assert(((await win.textContent('#panel')) ?? '').includes('Treinou para a revanche'), 'adversário treinou');
  await shot('26-rematch');
  await win.click('[data-action="fight-rematch"]');
  await forfeitNow();
  await win.waitForSelector('.modal-result', { timeout: 15000 });
  const p = await state();
  assert(p.rematch === null && p.rivals.marcus.losses === losses0 + 1, 'revanche registrada na memória do rival');
  assert(!(await win.locator('[data-r="again"]').count()), 'sem botão de revanche instantânea');
  await win.click('[data-r="close"]');
});

await step('27. Ferimento: médico do ludus cura', async () => {
  assert((await state()).injury, 'ferido após desistir');
  await goTo('ludus');
  await win.waitForSelector('.medic-card');
  await win.click('[data-action="medic"]');
  assert((await state()).injury === null, 'médico tratou o ferimento');
});

await step('28. Ferreiro e mercador viajante', async () => {
  const md = await win.evaluate(() => {
    const p = window.__colosseum.store.state;
    for (let d = p.day; d < p.day + 40; d++) if (window.__colosseum.isMerchantDay(d)) return d;
    return 0;
  });
  assert(md, 'mercador aparece em até 40 dias');
  await win.evaluate((d) => window.__colosseum.store.update((p) => { p.day = d; p.minutes = 10 * 60; p.coins += 3000; p.level = Math.max(p.level, 16); }), md);
  await goTo('market');
  await win.waitForTimeout(1200);
  const cart = await win.evaluate(() => window.__colosseum.view.game.scene.getScene('hub').children.list.some((o) => o.texture && o.texture.key === 'fx:merchant_cart'));
  assert(cart, 'carroça do mercador na praça');
  await win.click('[data-action="tab"][data-id="merchant"]');
  const n0 = (await state()).inventory.length;
  await win.click('[data-action="merchant-buy"]:not([disabled])');
  assert((await state()).inventory.length === n0 + 1, 'comprou do mercador');
  await shot('28-merchant');
  await win.click('[data-action="tab"][data-id="forge"]');
  await win.click('[data-action="forge"]:not([disabled])');
  assert((await state()).inventory.some((i) => i.plus === 1), 'item melhorado no ferreiro (+1)');
  await shot('28-forge');
});

await step('29. Queda de braço na taverna (domingo à noite)', async () => {
  await win.evaluate(() => window.__colosseum.store.update((p) => { p.day = 14; p.minutes = 20 * 60; p.energy = 80; }));
  await goTo('tavern');
  await win.waitForSelector('[data-action="arm"]:not([disabled])');
  await win.click('[data-action="arm"]');
  await win.waitForSelector('.modal-arm');
  await shot('29-arm');
  await win.keyboard.press('Space');
  await win.waitForTimeout(500);
  await win.keyboard.press('Escape');
  await win.waitForTimeout(500);
  const p = await state();
  assert(p.events.armDay === 14, 'disputa registrada (uma por domingo)');
  assert(await win.locator('[data-action="arm"][disabled]').count(), 'só uma vez por domingo');
});

await step('30. Torneio de sábado: inscrição, chave e prêmio', async () => {
  await win.evaluate(() => window.__colosseum.store.update((p) => { p.day = 15; p.minutes = 10 * 60; p.energy = 100; p.injury = null; }));
  await goTo('arena');
  await win.click('[data-action="tour-register"]');
  assert((await state()).tournament.registered === 20, 'inscrito para o sábado (dia 20)');
  await win.evaluate(() => window.__colosseum.store.update((p) => { p.day = 20; p.minutes = 14 * 60; p.energy = 100; p.location = 'arena'; }));
  await win.click('[data-action="tour-start"]');
  await win.waitForSelector('.modal-bracket');
  assert((await win.locator('.bracket .bk-f').count()) >= 8, 'chave com 8 lutadores');
  await shot('30-bracket');
  await win.click('[data-t="fight"]');
  await forfeitNow();
  await win.waitForSelector('.modal-bracket [data-t="claim"]', { timeout: 15000 });
  const run = (await state()).tournament.run;
  assert(run.done && run.winners.length === 7, 'torneio simulado até a final');
  const fame0 = (await state()).reputation;
  await win.click('[data-t="claim"]');
  const p = await state();
  assert(p.tournament.run === null && p.reputation === fame0 + 1, 'prêmio de participação');
});

await step('32. Chuva começando e parando não trava a cena (figurantes saem e voltam)', async () => {
  // a chuva dura o dia inteiro: alterna entre um dia de chuva e um de sol
  const days = await win.evaluate(() => {
    let rain = 0, sun = 0;
    for (let d = 2; d < 300 && (!rain || !sun); d++) {
      if (d % 7 === 0) continue;
      const w = window.__colosseum.weatherOfDay(d);
      if (w.kind === 'rain' && !rain) rain = d;
      if (w.kind === 'sun' && !sun) sun = d;
    }
    return { rain, sun };
  });
  await win.evaluate((d) => window.__colosseum.store.update((p) => { p.day = d.sun; p.minutes = 10 * 60; p.energy = 100; }), days);
  await goTo('ludus');
  const errs0 = errors.length;
  for (let i = 0; i < 12; i++) {
    await win.evaluate((d) => window.__colosseum.store.update((p) => (p.day = d.rain)), days);
    await win.waitForTimeout(350 + ((i * 37) % 300));
    await win.evaluate((d) => window.__colosseum.store.update((p) => (p.day = d.sun)), days);
    await win.waitForTimeout(350 + ((i * 53) % 700));
  }
  const fps = await win.evaluate(async () => {
    const g = window.__colosseum.view.game;
    const f0 = g.loop.frame;
    await new Promise((res) => setTimeout(res, 1000));
    return g.loop.frame - f0;
  });
  assert(errors.length === errs0, `sem erros (${errors.slice(errs0).join('; ')})`);
  assert(fps > 3, `animação continua rodando (${fps} quadros/s)`);
});

await step('34. Local que fecha esvazia (as pessoas vão embora) e taverna cheia em noite de chuva', async () => {
  const sunny = await win.evaluate(() => { for (let d = 2; d < 300; d++) { const w = window.__colosseum.weatherOfDay(d); if (w.kind === 'sun' && d % 7 !== 0) return d; } return 2; });
  await win.evaluate((d) => window.__colosseum.store.update((p) => { p.day = d; p.minutes = 19 * 60; }), sunny);
  await goTo('market');
  await win.waitForTimeout(800);
  const before = await win.evaluate(() => window.__colosseum.view.game.scene.getScene('hub').npcs.length);
  assert(before >= 3, `mercado aberto com gente (${before})`);
  await win.evaluate(() => window.__colosseum.store.update((p) => (p.minutes = 20 * 60 + 5)));
  await win.waitForFunction(() => window.__colosseum.view.game.scene.getScene('hub').npcs.length === 0, null, { timeout: 40000 });
  await win.evaluate(() => window.__colosseum.store.update((p) => (p.minutes = 21 * 60)));
  await goTo('ludus');
  await goTo('market');
  assert((await win.evaluate(() => window.__colosseum.view.game.scene.getScene('hub').npcs.length)) === 0, 'mercado fechado vazio');
  const rainy = await win.evaluate(() => { for (let d = 2; d < 300; d++) { const w = window.__colosseum.weatherOfDay(d); if (w.kind === 'rain' && d % 7 !== 0) return d; } return 2; });
  await win.evaluate((d) => window.__colosseum.store.update((p) => { p.day = d; p.minutes = 20 * 60; }), rainy);
  await goTo('tavern');
  const crowd = await win.evaluate(() => window.__colosseum.view.game.scene.getScene('hub').npcs.length);
  assert(crowd >= 10, `taverna cheia em noite de chuva (${crowd})`);
  await shot('34-taverna-chuva');
});

await step('33. Rede de segurança: um erro na cena não congela o jogo', async () => {
  const before = errors.length;
  await win.evaluate(() => window.__colosseum.view.game.scene.getScene('hub').time.delayedCall(50, () => { throw new Error('teste de recuperação'); }));
  await win.waitForTimeout(1500);
  const fps = await win.evaluate(async () => {
    const g = window.__colosseum.view.game;
    const f0 = g.loop.frame;
    await new Promise((res) => setTimeout(res, 1000));
    return g.loop.frame - f0;
  });
  errors.splice(before); // o erro foi provocado de propósito
  assert(fps > 3, `animação religada depois do erro (${fps} quadros/s)`);
});

const snapshot = await state();

await step('19. Salvamento, fechamento e reabertura', async () => {
  await win.waitForTimeout(800);
  await app.close();
  await launch();
  await playSlot(1);
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
  await playSlot(1);
  await win.waitForSelector('#panel .panel-head', { timeout: 10000 });
  assert((await state()).name === snapshot.name, 'recuperado do backup');
});

await step('31. Menu principal: voltar e saves separados', async () => {
  await win.keyboard.press('Escape');
  await win.click('[data-p="menu"]');
  await win.waitForSelector('#title .slot-card');
  const txt = (await win.textContent('#title')) ?? '';
  assert(txt.includes(snapshot.name), 'espaço 1 mostra o gladiador');
  assert((await win.locator('#title .slot-card.empty').count()) === 2, 'espaços 2 e 3 vazios');
  await playSlot(2);
  await win.waitForSelector('.title-screen', { timeout: 10000 });
  assert(!fs.existsSync(path.join(USER_DATA, 'saves', 'slot2.json')), 'slot 2 só é criado ao terminar a criação');
  await shot('31-slots');
});

await app.close();
const failed = results.filter((r) => !r.ok);
if (errors.length) console.log(`\nErros de página capturados:\n  ${errors.join('\n  ')}`);
console.log(`\n${results.length - failed.length}/${results.length} etapas aprovadas.`);
fs.rmSync(USER_DATA, { recursive: true, force: true });
process.exit(failed.length || errors.length ? 1 : 0);
