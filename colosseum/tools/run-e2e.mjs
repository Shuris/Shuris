// Executa o teste E2E. Compila antes se necessário e usa Xvfb no Linux sem display.
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

if (!fs.existsSync('dist/main/main.js') || !fs.existsSync('dist/renderer/index.html') || process.argv.includes('--build')) {
  execSync('npm run build', { stdio: 'inherit' });
}
const cmd = ['node', 'tests/e2e/app.e2e.mjs'];
const needsXvfb = process.platform === 'linux' && !process.env.DISPLAY;
const r = needsXvfb
  ? spawnSync('xvfb-run', ['-a', '-s', '-screen 0 1600x1000x24', ...cmd], { stdio: 'inherit' })
  : spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });
process.exit(r.status ?? 1);
