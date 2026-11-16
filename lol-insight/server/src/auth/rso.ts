import { createHash, randomBytes } from 'node:crypto';

import { AppError } from '../errors.ts';
import type { AuthRepository } from './authRepository.ts';
import type { Authenticated } from './authService.ts';
import type { TokenCipher } from './crypto.ts';

/**
 * Riot Sign On (RSO) — PREPARAÇÃO, DESATIVADA.
 *
 * O RSO é o OAuth2/OpenID Connect oficial da Riot e só é liberado para
 * aplicações de produção aprovadas. Enquanto não houver aprovação, este módulo
 * responde RSO_NOT_CONFIGURED e nenhuma conta é marcada como verificada.
 *
 * Quando a Riot aprovar a aplicação e fornecer as credenciais:
 *   RSO_CLIENT_ID, RSO_CLIENT_SECRET, RSO_REDIRECT_URI e RSO_ISSUER (emissor OIDC
 *   informado pela Riot). Os endereços de autorização e de token são lidos do
 *   documento de descoberta do emissor (/.well-known/openid-configuration);
 *   nenhum endereço é fixado aqui. RSO_ACCOUNT_URL é o endpoint que devolve a
 *   conta Riot do token de acesso, conforme a documentação entregue pela Riot.
 *
 * O fluxo usa Authorization Code + PKCE (S256), state de uso único com validade
 * de 10 minutos e guarda os tokens criptografados (AES-256-GCM).
 * ESTE FLUXO NÃO FOI TESTADO CONTRA A RIOT: só contra um provedor simulado.
 */

export interface RsoConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  issuer: string;
  accountUrl: string;
}

type JsonFetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const STATE_TTL_MS = 10 * 60_000;

export class RsoService {
  constructor(
    private config: RsoConfig | null,
    private repo: AuthRepository,
    private cipher: TokenCipher,
    private fetchJson: JsonFetch = (url, init) => fetch(url, init),
    private now: () => number = Date.now,
  ) {}

  status() {
    return this.config
      ? { available: true, reason: 'Verificação pelo Riot Sign On configurada.' }
      : {
          available: false,
          reason: 'A verificação oficial (Riot Sign On) depende de aprovação da aplicação pela Riot Games. Até lá, as contas vinculadas aparecem como não verificadas.',
        };
  }

  private require(): RsoConfig {
    if (!this.config) throw new AppError('RSO_NOT_CONFIGURED', this.status().reason);
    return this.config;
  }

  private async discovery(cfg: RsoConfig): Promise<{ authorization_endpoint: string; token_endpoint: string }> {
    const res = await this.fetchJson(`${cfg.issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`);
    const doc = (await res.json()) as { authorization_endpoint?: string; token_endpoint?: string };
    if (!res.ok || !doc.authorization_endpoint || !doc.token_endpoint) throw new AppError('RIOT_UNAVAILABLE', 'Não foi possível ler a configuração do Riot Sign On.');
    return { authorization_endpoint: doc.authorization_endpoint, token_endpoint: doc.token_endpoint };
  }

  async start(auth: Authenticated): Promise<{ authorizationUrl: string }> {
    const cfg = this.require();
    const { authorization_endpoint } = await this.discovery(cfg);
    const state = randomBytes(24).toString('base64url');
    const codeVerifier = randomBytes(48).toString('base64url');
    const nonce = randomBytes(16).toString('base64url');
    const now = this.now();
    this.repo.saveOAuthState({ state, userId: auth.user.id, codeVerifier, nonce, now, expiresAt: now + STATE_TTL_MS });
    const url = new URL(authorization_endpoint);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      scope: 'openid',
      state,
      nonce,
      code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return { authorizationUrl: url.toString() };
  }

  /** Retorno do provedor: valida o state, troca o código pelos tokens e marca a conta como verificada. */
  async callback(params: { code?: string | null; state?: string | null; error?: string | null }): Promise<{ gameName: string; tagLine: string }> {
    const cfg = this.require();
    if (params.error) throw new AppError('INVALID_PARAMS', 'A autorização no Riot Sign On foi cancelada ou recusada.');
    const saved = params.state ? this.repo.takeOAuthState(params.state, this.now()) : null;
    if (!saved || !params.code) throw new AppError('INVALID_PARAMS', 'Pedido de vinculação inválido ou expirado. Comece de novo pelo aplicativo.');

    const { token_endpoint } = await this.discovery(cfg);
    const tokenRes = await this.fetchJson(token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: params.code, redirect_uri: cfg.redirectUri, code_verifier: saved.codeVerifier }).toString(),
    });
    const tokens = (await tokenRes.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!tokenRes.ok || !tokens.access_token) throw new AppError('RIOT_AUTH', 'O Riot Sign On recusou a troca do código de autorização.');

    const accountRes = await this.fetchJson(cfg.accountUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const account = (await accountRes.json()) as { puuid?: string; gameName?: string; tagLine?: string };
    if (!accountRes.ok || !account.puuid) throw new AppError('RIOT_AUTH', 'Não foi possível obter a conta Riot autorizada.');

    // O RSO comprova a posse de uma conta já vinculada pelo Riot ID (a região vem dessa vinculação).
    const existing = this.repo.riotAccountByPuuid(saved.userId, account.puuid);
    if (!existing) throw new AppError('NOT_FOUND', 'Vincule essa conta pelo Riot ID antes de verificá-la pelo Riot Sign On.');
    const now = this.now();
    try {
      this.repo.markRiotVerified(existing.id, {
        subject: account.puuid,
        accessEnc: this.cipher.encrypt(tokens.access_token),
        refreshEnc: tokens.refresh_token ? this.cipher.encrypt(tokens.refresh_token) : null,
        expiresAt: tokens.expires_in ? now + tokens.expires_in * 1000 : null,
        gameName: account.gameName ?? null,
        tagLine: account.tagLine ?? null,
        now,
      });
    } catch (e) {
      if (String(e).includes('UNIQUE')) throw new AppError('RIOT_ACCOUNT_LINKED', 'Essa conta Riot já foi verificada por outro usuário.');
      throw e;
    }
    return { gameName: account.gameName ?? '', tagLine: account.tagLine ?? '' };
  }
}
