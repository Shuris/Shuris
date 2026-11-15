import type { Region } from '@/types';

/** Códigos de erro que a interface sabe explicar. Os do backend chegam com o mesmo nome. */
export type ServiceErrorCode =
  | 'INVALID_RIOT_ID'
  | 'INVALID_REGION'
  | 'PLAYER_NOT_FOUND'
  | 'WRONG_REGION'
  | 'MATCH_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'RIOT_AUTH'
  | 'MISSING_API_KEY'
  | 'RIOT_UNAVAILABLE'
  | 'SERVER_UNREACHABLE'
  | 'UNKNOWN';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly retryAfterSec?: number;
  readonly suggestedRegion?: Region;

  constructor(code: ServiceErrorCode, message: string, extra: { retryAfterSec?: number; suggestedRegion?: Region } = {}) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.retryAfterSec = extra.retryAfterSec;
    this.suggestedRegion = extra.suggestedRegion;
  }
}

export interface ErrorPresentation {
  icon: 'person-remove-outline' | 'at-outline' | 'earth-outline' | 'cloud-offline-outline' | 'hourglass-outline' | 'key-outline' | 'wifi-outline' | 'alert-circle-outline';
  title: string;
  /** Orientação prática exibida abaixo da mensagem do erro. */
  hint: string;
}

const PRESENTATION: Record<ServiceErrorCode, ErrorPresentation> = {
  PLAYER_NOT_FOUND: { icon: 'person-remove-outline', title: 'Jogador não encontrado', hint: 'Confira o nome e a tag do Riot ID (ex.: Nome#BR1).' },
  INVALID_RIOT_ID: { icon: 'at-outline', title: 'Riot ID inválido', hint: 'Use o formato Nome#TAG — nome com 3 a 16 caracteres e tag com 3 a 5.' },
  INVALID_REGION: { icon: 'earth-outline', title: 'Região inválida', hint: 'Escolha uma região na lista ao lado do campo de busca.' },
  WRONG_REGION: { icon: 'earth-outline', title: 'Região incorreta', hint: 'A conta existe, mas em outro servidor. Troque a região e pesquise de novo.' },
  MATCH_NOT_FOUND: { icon: 'alert-circle-outline', title: 'Partida indisponível', hint: 'A Riot não disponibiliza mais os detalhes desta partida.' },
  RATE_LIMITED: { icon: 'hourglass-outline', title: 'Limite de requisições atingido', hint: 'A Riot limita a quantidade de consultas por minuto. Aguarde e tente de novo.' },
  RIOT_AUTH: { icon: 'key-outline', title: 'Erro de autenticação', hint: 'A chave da Riot API do servidor é inválida ou expirou (chaves de desenvolvimento duram 24 h). Gere outra e atualize server/.env.' },
  MISSING_API_KEY: { icon: 'key-outline', title: 'Servidor sem chave da Riot', hint: 'Defina RIOT_API_KEY em server/.env e reinicie o servidor.' },
  RIOT_UNAVAILABLE: { icon: 'cloud-offline-outline', title: 'API da Riot indisponível', hint: 'O serviço da Riot não respondeu. Tente novamente em instantes.' },
  SERVER_UNREACHABLE: { icon: 'wifi-outline', title: 'Servidor do LOL Insight inacessível', hint: 'Verifique se o servidor está rodando e se o endereço em Perfil → Fonte de dados está correto.' },
  UNKNOWN: { icon: 'alert-circle-outline', title: 'Não foi possível carregar', hint: 'Tente novamente.' },
};

export function describeError(code: string | undefined): ErrorPresentation {
  return PRESENTATION[(code as ServiceErrorCode) ?? 'UNKNOWN'] ?? PRESENTATION.UNKNOWN;
}
