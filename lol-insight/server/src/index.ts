import { networkInterfaces } from 'node:os';

import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { startHttpServer } from './http/server.ts';

const config = loadConfig();
const app = createApp(config);

const server = await startHttpServer({ accounts: app.accounts, logger: app.logger, hasApiKey: () => app.client.hasKey }, config.port, config.host);

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal)
  .map((n) => `http://${n!.address}:${config.port}`);

app.logger.info(`LOL Insight server em http://localhost:${config.port}`);
if (lan.length) app.logger.info(`Na rede local (use no celular): ${lan.join('  ')}`);
if (!app.client.hasKey) {
  app.logger.warn('RIOT_API_KEY não definida: copie server/.env.example para server/.env e preencha a chave. As buscas reais vão falhar até lá.');
}

const shutdown = () => {
  server.close();
  app.db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
