/** Log simples em linha única. Qualquer trecho com formato de chave da Riot é mascarado. */
const KEY_PATTERN = /RGAPI-[\w-]+/g;

export function redact(text: string): string {
  return text.replace(KEY_PATTERN, 'RGAPI-***');
}

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

function line(level: string, message: string, data?: Record<string, unknown>): string {
  const extra = data ? ' ' + JSON.stringify(data) : '';
  return redact(`${new Date().toISOString()} ${level} ${message}${extra}`);
}

export const consoleLogger: Logger = {
  info: (m, d) => console.log(line('INFO ', m, d)),
  warn: (m, d) => console.warn(line('WARN ', m, d)),
  error: (m, d) => console.error(line('ERROR', m, d)),
};

export const silentLogger: Logger = { info() {}, warn() {}, error() {} };
