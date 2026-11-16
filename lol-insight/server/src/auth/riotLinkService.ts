import type { Region } from '../../../src/types/index.ts';
import { AppError } from '../errors.ts';
import { isRegion } from '../regions.ts';
import type { AccountService } from '../services/accountService.ts';
import type { AuthRepository, RiotAccountRow } from './authRepository.ts';
import type { Authenticated } from './authService.ts';
import { newId } from './crypto.ts';

const MAX_LINKED = 5;

export interface PublicRiotAccount {
  id: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  region: Region;
  verificationStatus: 'unverified' | 'rso_verified';
  isPrimary: boolean;
  linkedAt: number;
  verifiedAt: number | null;
}

export const toPublicRiot = (r: RiotAccountRow): PublicRiotAccount => ({
  id: r.id,
  puuid: r.puuid,
  gameName: r.gameName,
  tagLine: r.tagLine,
  region: r.region,
  verificationStatus: r.verificationStatus,
  isPrimary: r.isPrimary,
  linkedAt: r.linkedAt,
  verifiedAt: r.verifiedAt,
});

/**
 * Vinculação de contas Riot ao usuário.
 *
 * Sem o Riot Sign On (que depende de aprovação da Riot) não há como comprovar que
 * a conta pertence a quem a vinculou. Por isso toda vinculação feita aqui é
 * "não verificada": o Riot ID existe e foi encontrado na região informada, nada mais.
 * Várias pessoas podem vincular o mesmo perfil não verificado.
 */
export class RiotLinkService {
  constructor(
    private repo: AuthRepository,
    private accounts: AccountService,
    private now: () => number = Date.now,
  ) {}

  list(auth: Authenticated): PublicRiotAccount[] {
    return this.repo.riotAccounts(auth.user.id).map(toPublicRiot);
  }

  primary(userId: string): RiotAccountRow | null {
    return this.repo.primaryRiotAccount(userId);
  }

  async link(auth: Authenticated, input: { gameName?: unknown; tagLine?: unknown; region?: unknown }): Promise<PublicRiotAccount> {
    if (auth.user.emailVerifiedAt === null) throw new AppError('EMAIL_NOT_VERIFIED', 'Confirme seu e-mail antes de vincular uma conta Riot.');
    const region = typeof input.region === 'string' ? input.region.toUpperCase() : '';
    if (!isRegion(region)) throw new AppError('INVALID_REGION', 'Escolha uma região válida.');
    const existing = this.repo.riotAccounts(auth.user.id);
    if (existing.length >= MAX_LINKED) throw new AppError('INVALID_PARAMS', `É possível vincular no máximo ${MAX_LINKED} contas Riot.`);

    // Resolve o Riot ID na Riot (valida formato, existência e região) e já inicia a coleta de partidas.
    const bundle = await this.accounts.getBundle(region, String(input.gameName ?? ''), String(input.tagLine ?? ''), { count: 20, waitMs: 0 });
    const puuid = bundle.player.puuid!;
    if (existing.some((a) => a.puuid === puuid)) throw new AppError('RIOT_ACCOUNT_LINKED', 'Essa conta Riot já está vinculada ao seu perfil.');

    const id = newId('ria');
    this.repo.insertRiotAccount({
      id,
      userId: auth.user.id,
      puuid,
      gameName: bundle.player.gameName,
      tagLine: bundle.player.tagLine,
      region,
      primary: existing.length === 0,
      now: this.now(),
    });
    return toPublicRiot(this.repo.riotAccount(auth.user.id, id)!);
  }

  setPrimary(auth: Authenticated, id: string): PublicRiotAccount[] {
    if (!this.repo.riotAccount(auth.user.id, id)) throw new AppError('NOT_FOUND', 'Conta Riot não encontrada.');
    this.repo.setPrimaryRiotAccount(auth.user.id, id);
    return this.list(auth);
  }

  unlink(auth: Authenticated, id: string): PublicRiotAccount[] {
    const account = this.repo.riotAccount(auth.user.id, id);
    if (!account || !this.repo.deleteRiotAccount(auth.user.id, id)) throw new AppError('NOT_FOUND', 'Conta Riot não encontrada.');
    if (account.isPrimary) {
      const next = this.repo.riotAccounts(auth.user.id)[0];
      if (next) this.repo.setPrimaryRiotAccount(auth.user.id, next.id);
    }
    return this.list(auth);
  }
}
