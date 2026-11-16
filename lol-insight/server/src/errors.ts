/** Códigos de erro expostos ao aplicativo (cada um tem mensagem própria na interface). */
export type ErrorCode =
  | 'INVALID_RIOT_ID'
  | 'INVALID_REGION'
  | 'INVALID_PARAMS'
  | 'PLAYER_NOT_FOUND'
  | 'WRONG_REGION'
  | 'MATCH_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'RIOT_AUTH'
  | 'MISSING_API_KEY'
  | 'RIOT_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'INTERNAL'
  | 'AUTH_REQUIRED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'TOO_MANY_ATTEMPTS'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'INVALID_EMAIL'
  | 'INVALID_USERNAME'
  | 'WEAK_PASSWORD'
  | 'INVALID_CODE'
  | 'EMAIL_NOT_VERIFIED'
  | 'RIOT_ACCOUNT_LINKED'
  | 'NO_RIOT_ACCOUNT'
  | 'RSO_NOT_CONFIGURED';

const STATUS: Record<ErrorCode, number> = {
  INVALID_RIOT_ID: 400,
  INVALID_REGION: 400,
  INVALID_PARAMS: 400,
  PLAYER_NOT_FOUND: 404,
  WRONG_REGION: 404,
  MATCH_NOT_FOUND: 404,
  RATE_LIMITED: 429,
  RIOT_AUTH: 502,
  MISSING_API_KEY: 503,
  RIOT_UNAVAILABLE: 503,
  NOT_FOUND: 404,
  INTERNAL: 500,
  AUTH_REQUIRED: 401,
  TOKEN_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  TOO_MANY_ATTEMPTS: 429,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  INVALID_EMAIL: 400,
  INVALID_USERNAME: 400,
  WEAK_PASSWORD: 400,
  INVALID_CODE: 400,
  EMAIL_NOT_VERIFIED: 403,
  RIOT_ACCOUNT_LINKED: 409,
  NO_RIOT_ACCOUNT: 409,
  RSO_NOT_CONFIGURED: 503,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return STATUS[this.code];
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, ...this.details } };
  }
}

/** Erro interno do cliente Riot: recurso inexistente (HTTP 404). Cada serviço decide o significado. */
export class RiotNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`Riot API 404: ${path}`);
    this.name = 'RiotNotFoundError';
  }
}
