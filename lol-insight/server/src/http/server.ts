import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { AppError } from '../errors.ts';
import type { Logger } from '../logger.ts';
import { isRegion, REGION_CODES } from '../regions.ts';
import type { AccountService } from '../services/accountService.ts';
import { ALLOWED_COUNTS } from '../services/syncService.ts';

export interface HttpDeps {
  accounts: AccountService;
  logger: Logger;
  hasApiKey: () => boolean;
  /** Requisições por minuto aceitas de um mesmo cliente. */
  clientLimitPerMinute?: number;
}

const json = (res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    ...extra,
  });
  res.end(JSON.stringify(body));
};

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    throw new AppError('INVALID_PARAMS', 'Parâmetro malformado na URL.');
  }
};

/** Roteador mínimo sobre node:http. Rotas somente de leitura; a chave da Riot nunca aparece em respostas. */
export function createHttpHandler(deps: HttpDeps) {
  const limit = deps.clientLimitPerMinute ?? 120;
  const hits = new Map<string, number[]>();

  const throttle = (ip: string) => {
    const now = Date.now();
    const list = (hits.get(ip) ?? []).filter((t) => t > now - 60_000);
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 5000) hits.clear();
    if (list.length > limit) throw new AppError('RATE_LIMITED', 'Muitas requisições deste dispositivo. Aguarde um instante.', { retryAfterSec: 30 });
  };

  const route = async (req: IncomingMessage): Promise<unknown> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method !== 'GET') throw new AppError('NOT_FOUND', 'Rota não encontrada.');

    if (url.pathname === '/health') {
      return { ok: true, service: 'lol-insight-server', riotApiKeyConfigured: deps.hasApiKey(), regions: REGION_CODES, time: Date.now() };
    }

    throttle(req.socket.remoteAddress ?? 'unknown');

    // GET /v1/accounts/:region/:gameName/:tagLine?count=20&refresh=1
    if (parts.length === 5 && parts[0] === 'v1' && parts[1] === 'accounts') {
      const region = decode(parts[2]).toUpperCase();
      if (!isRegion(region)) throw new AppError('INVALID_REGION', `Região inválida. Use uma de: ${REGION_CODES.join(', ')}.`);
      const count = Number(url.searchParams.get('count') ?? 20);
      if (!ALLOWED_COUNTS.includes(count as (typeof ALLOWED_COUNTS)[number])) {
        throw new AppError('INVALID_PARAMS', `"count" deve ser um de: ${ALLOWED_COUNTS.join(', ')}.`);
      }
      return deps.accounts.getBundle(region, decode(parts[3]), decode(parts[4]), { count, refresh: url.searchParams.get('refresh') === '1' });
    }

    // GET /v1/matches/:matchId/details?puuid=...
    if (parts.length === 4 && parts[0] === 'v1' && parts[1] === 'matches' && parts[3] === 'details') {
      const matchId = decode(parts[2]);
      const puuid = url.searchParams.get('puuid') ?? '';
      if (!/^[A-Z0-9]{2,5}_\d{5,}$/.test(matchId) || !/^[\w-]{20,100}$/.test(puuid)) {
        throw new AppError('INVALID_PARAMS', 'Identificador de partida ou de jogador inválido.');
      }
      return deps.accounts.getMatchDetails(matchId, puuid);
    }

    throw new AppError('NOT_FOUND', 'Rota não encontrada.');
  };

  return async (req: IncomingMessage, res: ServerResponse) => {
    const started = Date.now();
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }
    let status = 200;
    try {
      json(res, 200, await route(req));
    } catch (e) {
      const err = e instanceof AppError ? e : new AppError('INTERNAL', 'Erro interno do servidor.');
      if (!(e instanceof AppError)) deps.logger.error('http: erro inesperado', { reason: e instanceof Error ? e.message : String(e) });
      status = err.status;
      const retry = err.details.retryAfterSec;
      json(res, status, err.toJSON(), typeof retry === 'number' ? { 'Retry-After': String(retry) } : {});
    }
    // Registra só método, caminho (sem query) e resultado — nunca cabeçalhos.
    deps.logger.info('http', { method: req.method, path: (req.url ?? '').split('?')[0], status, ms: Date.now() - started });
  };
}

export function startHttpServer(deps: HttpDeps, port: number, host: string): Promise<Server> {
  const server = createServer(createHttpHandler(deps));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}
