import { networkInterfaces } from 'node:os';

import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { httpDepsFrom, startHttpServer } from './http/server.ts';

const config = loadConfig();
const app = createApp(config);

const server = await startHttpServer({ ...httpDepsFrom(app), allowedOrigins: config.allowedOrigins, trustProxy: config.trustProxy }, config.port, config.host);
if (config.allowedOrigins.includes('*')) app.logger.warn('CORS aberto para qualquer origem (ALLOWED_ORIGINS=*). Em produção, defina o endereço da versão web.');

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal)
  .map((n) => `http://${n!.address}:${config.port}`);

app.logger.info(`LOL Insight server em http://localhost:${config.port}`);
if (lan.length) app.logger.info(`Na rede local (use no celular): ${lan.join('  ')}`);
app.logger.warn('E-mail em modo de desenvolvimento: nenhum e-mail é enviado; os códigos de verificação e de redefinição aparecem neste terminal.');
if (!config.rso) app.logger.info('Riot Sign On não configurado: contas Riot vinculadas ficam como "não verificadas".');
setInterval(() => app.throttle.prune(), 3_600_000).unref();
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
