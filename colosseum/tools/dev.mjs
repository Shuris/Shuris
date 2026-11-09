// Modo desenvolvimento: servidor Vite com HMR + Electron apontando para ele.
import { createServer } from 'vite';
import { spawn, execSync } from 'node:child_process';
import electronPath from 'electron';

const server = await createServer({ configFile: 'vite.config.ts' });
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5173/';
execSync('node tools/build-main.mjs', { stdio: 'inherit' });

const args = ['.'];
if (process.getuid && process.getuid() === 0) args.push('--no-sandbox');
const child = spawn(electronPath, args, {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});
child.on('close', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
