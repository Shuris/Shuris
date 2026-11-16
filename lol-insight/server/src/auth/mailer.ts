import type { Logger } from '../logger.ts';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  /** Tipo da mensagem, para os testes localizarem o código certo. */
  kind: 'verify-email' | 'password-reset';
  code: string;
}

/**
 * Envio de e-mail. Um provedor real (SMTP, Amazon SES, Resend...) é um serviço
 * externo e precisa ser configurado à parte: basta implementar esta interface.
 */
export interface Mailer {
  readonly kind: 'console' | 'memory' | string;
  send(mail: OutgoingMail): Promise<void>;
}

/**
 * Modo de desenvolvimento: NÃO envia e-mail. Escreve a mensagem no terminal do
 * servidor, claramente identificada, para que o código possa ser usado nos testes.
 */
export class ConsoleMailer implements Mailer {
  readonly kind = 'console';
  constructor(private logger: Logger) {}

  async send(mail: OutgoingMail): Promise<void> {
    this.logger.warn(`[E-MAIL DE DESENVOLVIMENTO — não enviado] para ${mail.to} · ${mail.subject} · código: ${mail.code}`);
  }
}

/** Usado nos testes automatizados. */
export class MemoryMailer implements Mailer {
  readonly kind = 'memory';
  sent: OutgoingMail[] = [];

  async send(mail: OutgoingMail): Promise<void> {
    this.sent.push(mail);
  }

  last(to: string, kind: OutgoingMail['kind']): OutgoingMail | undefined {
    return [...this.sent].reverse().find((m) => m.to === to && m.kind === kind);
  }
}
