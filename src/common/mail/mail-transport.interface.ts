export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface MailTransport {
  send(options: SendMailOptions): Promise<boolean>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
