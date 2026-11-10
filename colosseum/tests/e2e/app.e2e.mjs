// Teste ponta a ponta do aplicativo Electron real (Playwright).
// Cobre os testes obrigatórios da especificação. Uso: npm run test:e2e
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
    results.push({ name, ok: true, ms: Date.now() - t0 });
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
    return { bounds: w.getBounds(), fullscreen: w.isFullScreen(), visible: w.isVisible() };
  });
const shot = async (name) => SHOTS && win.screenshot({ path: path.join(SHOTS, `${name}.png`) });

console.log(`COLOSSEUM E2E — dados em ${USER_DATA}`);
await launch();

await step('1. Inicialização do aplicativo (tela de apresentação)', async () => {
  await win.waitForSelector('.title-screen', { timeout: 10000 });
  assert((await win.title()) === 'Colosseum', 'título da janela');
  await shot('01-title');
});

await step('2. Criação do gladiador (validação + nome + aparência + introdução)', async () => {
  await win.click('[data-i="new"]');
  await win.fill('input[name="gname"]', 'X');
  await win.click('[data-i="next"]');
  const err = await win.textContent('.form-error');
  assert(err && err.length > 5, 'nome curto deveria ser rejeitado');
  await win.fill('input[name="gname"]', 'Maximus Decimus');
  await win.click('[data-i="origin"][data-v="thracian"]');
  await win.click('[data-i="skin"][data-v="1"]');
  await win.click('[data-i="beard"][data-v="1"]');
  await win.click('[data-i="next"]');
  await win.waitForSelector('.story');
  await win.click('[data-i="finish"]');
  await win.waitForSelector('#panel .hero-card');
  const p = await state();
  assert(p.name === 'Maximus Decimus' && p.origin === 'thracian' && p.appearance.beard, 'dados do gladiador');
  assert(p.baseAttributes.agi === 7, 'bônus de origem aplicado');
  await win.waitForTimeout(800);
  assert(fs.existsSync(SAVE), 'arquivo de salvamento criado');
  await shot('02-hub');
});

await step('4. Compra e equipamento de itens', async () => {
  await win.click('[data-tab="equipment"]');
  await win.click('[data-action="tab"][data-id="market"]');
  await win.click('[data-action="buy"][data-id="parmula"]');
  let p = await state();
  assert(p.coins === 90, `moedas após compra: ${p.coins}`);
  await win.click('[data-action="tab"][data-id="inventory"]');
  await win.click('[data-action="equip"]');
  p = await state();
  const uid = p.equipment.offHand;
  assert(uid && p.inventory.find((i) => i.uid === uid)?.itemId === 'parmula', 'escudo equipado');
  await win.click('[data-action="unequip"][data-id="offHand"]');
  assert((await state()).equipment.offHand === null, 'desequipar');
  await win.click('[data-action="equip"]');
  assert((await state()).equipment.offHand !== null, 'equipar de novo');
  await shot('04-equipment');
});

await step('5. Treinamento (custo, animação e progresso)', async () => {
  await win.click('[data-tab="training"]');
  const before = await state();
  await win.click('[data-action="train"][data-id="str"]');
  await win.waitForFunction(() => window.__colosseum.store.state.training.str.sessions === 1, null, { timeout: 5000 });
  const after = await state();
  assert(after.coins === before.coins - 25, 'custo cobrado');
  assert(after.training.str.progress === 25, 'progresso de treino');
  assert(after.xp > before.xp, 'experiência do treino');
  await win.waitForTimeout(300);
  const cost = await win.textContent('[data-action="train"][data-id="str"]');
  assert(cost.includes('30'), `custo progressivo (${cost.trim()})`);
});

await step('6-9. Batalha automática completa com animações e recompensas', async () => {
  await win.click('[data-tab="arena"]');
  await win.click('[data-action="strategy"][data-id="aggressive"]');
  assert((await state()).strategy === 'aggressive', 'estratégia');
  const before = await state();
  await win.click('.btn-fight');
  await win.waitForSelector('#hud .plate-0', { timeout: 10000 });
  await win.waitForTimeout(5000);
  await shot('06-battle');
  const mid = await win.evaluate(() => {
    const e = window.__colosseum.view.arena.engine;
    return { started: e.started, t: e.fightTime, hp: e.fighters.map((f) => f.hp), attacks: e.fighters.map((f) => f.counters.attacks) };
  });
  assert(mid.started && mid.t > 0, 'luta iniciada automaticamente');
  await win.click('[data-hud="speed"][data-v="3"]');
  await win.waitForSelector('.modal-result', { timeout: 150000 });
  await shot('08-result');
  const after = await state();
  assert(after.stats.battles === before.stats.battles + 1, 'luta registrada');
  assert(after.history.length === 1, 'histórico');
  const h = after.history[0];
  assert(after.xp !== before.xp || after.level > before.level, 'experiência recebida');
  assert(after.coins === before.coins + h.coins, 'moedas recebidas');
  assert(after.inventory.length >= before.inventory.length, 'nenhum item perdido');
  console.log(`      resultado: ${h.result} (${h.reason}) em ${h.duration}s, +${h.xp} XP, +${h.coins} moedas${h.itemId ? ', item ' + h.itemId : ''}`);
  await win.click('[data-r="close"]');
  await win.waitForSelector('#panel .hero-card');
  await win.click('[data-tab="history"]');
  assert((await win.locator('.hist').count()) === 1, 'tela de histórico');
});

await step('8b. Derrota não remove níveis/itens (desistência)', async () => {
  await win.click('[data-tab="arena"]');
  const before = await state();
  await win.click('.btn-fight');
  await win.waitForSelector('#hud [data-hud="forfeit"]');
  await win.waitForTimeout(4500);
  await win.click('[data-hud="forfeit"]');
  await win.click('.modal [data-a="ok"]');
  await win.waitForSelector('.modal-result', { timeout: 15000 });
  const after = await state();
  assert(after.history[0].result === 'loss' && after.history[0].reason === 'forfeit', 'derrota registrada');
  assert(after.level >= before.level && after.inventory.length === before.inventory.length, 'sem perdas');
  await win.click('[data-r="close"]');
});

await step('3/10. Evolução de nível e distribuição de atributos', async () => {
  // concede experiência pelo próprio sistema de progressão até subir de nível
  await win.evaluate(() => {
    const app = window.__colosseum;
    app.store.update((p) => {
      p.xp += 10000;
    });
  });
  // a experiência é convertida em níveis no próximo ganho real (treino)
  await win.click('[data-tab="training"]');
  await win.click('[data-action="train"][data-id="agi"]');
  await win.waitForFunction(() => window.__colosseum.store.state.level > 1, null, { timeout: 5000 });
  const p = await state();
  assert(p.unspentPoints === (p.level - 1) * 3, `pontos por nível (${p.unspentPoints})`);
  await win.click('[data-tab="gladiator"]');
  const str0 = p.baseAttributes.str;
  await win.click('[data-action="plus"][data-id="str"]');
  await win.click('[data-action="plus"][data-id="str"]');
  await win.click('[data-action="minus"][data-id="str"]');
  await win.click('[data-action="plus"][data-id="vit"]');
  await win.click('[data-action="confirm"]');
  const q = await state();
  assert(q.baseAttributes.str === str0 + 1 && q.unspentPoints === p.unspentPoints - 2, 'distribuição aplicada');
  await shot('10-character');
});

await step('16. Efeitos sonoros (Web Audio) durante a luta e na interface', async () => {
  const before = await win.evaluate(() => window.__colosseum.sound.played);
  await win.click('[data-tab="arena"]');
  await win.click('.btn-fight');
  await win.waitForSelector('#hud .plate-0', { timeout: 10000 });
  await win.waitForTimeout(7000);
  const s = await win.evaluate(() => ({ played: window.__colosseum.sound.played, ctx: window.__colosseum.sound.contextState }));
  assert(s.ctx === 'running', `contexto de áudio ativo (${s.ctx})`);
  assert(s.played - before >= 5, `sons tocados na luta (${s.played - before})`);
});

await step('17. Arena correta para o adversário (uma a cada dois)', async () => {
  const a = await win.evaluate(() => window.__colosseum.view.arena.arenaDef.id);
  assert(a === 'capua', `Marcus luta em Cápua (${a})`);
  await win.click('[data-hud="speed"][data-v="3"]');
  await win.click('[data-hud="forfeit"]');
  await win.click('.modal [data-a="ok"]');
  await win.waitForSelector('.modal-result', { timeout: 15000 });
  await win.click('[data-r="close"]');
  // libera Rufus (3º adversário) para conferir a segunda arena
  await win.evaluate(() => window.__colosseum.store.update((p) => { p.defeatedOpponents = ['marcus', 'cassius']; p.selectedOpponent = 'rufus'; }));
  await win.click('[data-tab="arena"]');
  await win.click('.btn-fight');
  await win.waitForSelector('#hud .plate-0', { timeout: 10000 });
  const b = await win.evaluate(() => window.__colosseum.view.arena.arenaDef.id);
  assert(b === 'pompeii', `Rufus luta em Pompeia (${b})`);
  await win.waitForTimeout(2500);
  await shot('17-pompeii');
});

await step('18. Ciclo de dia e noite (céu e iluminação mudam com a hora)', async () => {
  const sample = (ms) =>
    win.evaluate((ms) => {
      const real = Date.now;
      Date.now = () => ms;
      const sky = window.__colosseum.view.sky;
      sky.update(0.016);
      Date.now = real;
      return { t: sky.t, light: sky.state.light, ambient: sky.state.ambient };
    }, ms);
  const day = await sample(120000); // meio-dia no ciclo de 10 min
  const night = await sample(420000); // meia-noite
  assert(day.light > 0.9 && day.ambient === 0xffffff, `dia claro (${JSON.stringify(day)})`);
  assert(night.light < 0.2 && night.ambient !== 0xffffff, `noite escura (${JSON.stringify(night)})`);
  await win.click('[data-hud="speed"][data-v="3"]');
  await win.waitForSelector('.modal-result', { timeout: 150000 });
  await win.click('[data-r="close"]');
});

await step('19. Tela cheia (ativar e sair)', async () => {
  await win.click('[data-w="fullscreen"]');
  await win.waitForTimeout(1200);
  assert((await winInfo()).fullscreen === true, 'tela cheia ativa');
  assert((await win.locator('#titlebar').isVisible()) === false, 'barra de título oculta');
  await shot('19-fullscreen');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(1200);
  assert((await winInfo()).fullscreen === false, 'saiu da tela cheia');
  assert(await win.locator('#titlebar').isVisible(), 'barra de título de volta');
});

await step('15. Redimensionamento da janela', async () => {
  for (const [w, h] of [
    [980, 620],
    [1400, 880],
  ]) {
    await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setSize(w, h), [w, h]);
    await win.waitForTimeout(700);
    const c = await win.evaluate(() => {
      const cv = document.querySelector('#game canvas');
      return { cw: cv.clientWidth, ch: cv.clientHeight, iw: window.innerWidth, ih: window.innerHeight };
    });
    assert(Math.abs(c.cw - c.iw) <= 2 && c.ch > 0, `canvas acompanha a janela (${JSON.stringify(c)})`);
  }
  await shot('15-resized');
});

const snapshot = await state();

await step('11/12. Salvamento, fechamento e reabertura', async () => {
  await win.waitForTimeout(800);
  await app.close();
  const disk = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  assert(disk.player.name === snapshot.name, 'nome no disco');
  await launch();
  await win.waitForSelector('#panel .hero-card', { timeout: 10000 });
  const p = await state();
  for (const k of ['name', 'level', 'xp', 'coins', 'reputation', 'unspentPoints', 'strategy'])
    assert(JSON.stringify(p[k]) === JSON.stringify(snapshot[k]), `campo ${k} recuperado`);
  assert(JSON.stringify(p.baseAttributes) === JSON.stringify(snapshot.baseAttributes), 'atributos');
  assert(JSON.stringify(p.equipment) === JSON.stringify(snapshot.equipment), 'equipamentos');
  assert(p.inventory.length === snapshot.inventory.length, 'inventário');
  assert(p.history.length === snapshot.history.length, 'histórico');
  assert(JSON.stringify(p.training) === JSON.stringify(snapshot.training), 'treinamento');
  assert((await win.locator('.title-screen').count()) === 0, 'não volta para a criação');
});

await step('11b. Recuperação de salvamento corrompido via backup', async () => {
  await app.close();
  assert(fs.existsSync(BACKUP), 'backup existe');
  fs.writeFileSync(SAVE, '{ corrompido');
  await launch();
  await win.waitForSelector('#panel .hero-card', { timeout: 10000 });
  const p = await state();
  assert(p.name === snapshot.name, 'gladiador recuperado do backup');
});

await app.close();
const failed = results.filter((r) => !r.ok);
if (errors.length) console.log(`\nErros de página capturados:\n  ${errors.join('\n  ')}`);
console.log(`\n${results.length - failed.length}/${results.length} etapas aprovadas.`);
fs.rmSync(USER_DATA, { recursive: true, force: true });
process.exit(failed.length || errors.length ? 1 : 0);
