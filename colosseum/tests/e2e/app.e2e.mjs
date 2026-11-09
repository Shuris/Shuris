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
    return { bounds: w.getBounds(), top: w.isAlwaysOnTop(), visible: w.isVisible() };
  });
const winState = () => win.evaluate(() => window.colosseum.win.getState());
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

await step('13. Alternância para o modo companion', async () => {
  await win.click('[data-w="companion"]');
  await win.waitForFunction(() => document.getElementById('app').classList.contains('mode-companion'));
  const i = await winInfo();
  assert(i.bounds.width <= 500 && i.bounds.height <= 360, `janela pequena (${i.bounds.width}x${i.bounds.height})`);
  const s = await winState();
  assert(s.mode === 'companion', 'modo companion');
  assert((await win.locator('#titlebar').isVisible()) === false, 'sem barra de título');
  await win.waitForTimeout(600);
  await shot('13-companion');
});

await step('14. Sempre no topo (ativar/desativar)', async () => {
  assert((await winInfo()).top === true, 'sempre no topo ativo por padrão');
  await win.hover('#stage');
  await win.click('[data-c="top"]');
  await win.waitForTimeout(300);
  assert((await winInfo()).top === false, 'desativado');
  await win.click('[data-c="top"]');
  await win.waitForTimeout(300);
  assert((await winInfo()).top === true, 'reativado');
});

await step('14b. Clique-através reversível (bandeja/atalho usam o mesmo caminho)', async () => {
  await win.click('[data-c="click"]');
  await win.waitForTimeout(300);
  assert((await winState()).clickThrough === true, 'clique-através ativo');
  assert(await win.locator('#clickthrough-note').isVisible(), 'aviso com o atalho visível');
  const s = await winState();
  assert(s.shortcutErrors.length === 0, `atalhos globais registrados (${s.shortcutErrors})`);
  await win.evaluate(() => window.colosseum.win.setClickThrough(false));
  await win.waitForTimeout(300);
  assert((await winState()).clickThrough === false, 'desativado');
});

await step('7/13b. Batalha no modo companion', async () => {
  await win.hover('#stage');
  await win.click('[data-c="fight"]');
  await win.waitForSelector('#hud .plate-0', { timeout: 10000 });
  await win.waitForTimeout(6000);
  await shot('13b-companion-battle');
});

await step('15. Redimensionamento da janela durante a batalha', async () => {
  for (const [w, h] of [
    [300, 200],
    [620, 420],
  ]) {
    await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setSize(w, h), [w, h]);
    await win.waitForTimeout(700);
    const c = await win.evaluate(() => {
      const cv = document.querySelector('#game canvas');
      return { cw: cv.clientWidth, ch: cv.clientHeight, iw: window.innerWidth, ih: window.innerHeight };
    });
    assert(Math.abs(c.cw - c.iw) <= 2 && Math.abs(c.ch - c.ih) <= 2, `canvas acompanha a janela (${JSON.stringify(c)})`);
  }
  await shot('15-resized');
  const running = await win.evaluate(() => window.__colosseum.view.arena.engine.time);
  await win.waitForTimeout(500);
  const later = await win.evaluate(() => window.__colosseum.view.arena.engine.time);
  assert(later > running || (await win.evaluate(() => window.__colosseum.view.arena.engine.finished)), 'luta continua após redimensionar');
});

await step('13c. Retorno ao modo completo (batalha continua)', async () => {
  const t0 = await win.evaluate(() => window.__colosseum.view.arena.engine.time);
  await win.evaluate(() => window.colosseum.win.setMode('full'));
  await win.waitForFunction(() => document.getElementById('app').classList.contains('mode-full'));
  await win.waitForTimeout(500);
  const i = await winInfo();
  assert(i.bounds.width >= 960 && i.bounds.height >= 600, 'tamanho do modo completo restaurado');
  assert(i.top === false, 'modo completo não fica sempre no topo');
  const t1 = await win.evaluate(() => window.__colosseum.view.arena.engine.time);
  assert(t1 >= t0, 'mesma batalha (sem recarregar)');
  await win.click('[data-hud="speed"][data-v="3"]');
  await win.waitForSelector('.modal-result', { timeout: 150000 });
  await win.click('[data-r="close"]');
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
