import { ConfigType, registerAs } from '@nestjs/config';

function intEnv(name: string, def: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    return def;
  }
  return n;
}

export const mailConfig = registerAs('mail', () => {
  const enabled = process.env.MAIL_ENABLED !== 'false';
  const from = process.env.MAIL_FROM || 'MRM InfoTech <contact.mrminfotech@gmail.com>';
  const notifyRecipient = process.env.MAIL_NOTIFY_RECIPIENT || 'contact.mrminfotech@gmail.com';

  const port = intEnv('SMTP_PORT', 465, 1, 65535);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return {
    enabled,
    from,
    notifyRecipient,
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure,
      user: process.env.SMTP_USER || 'contact.mrminfotech@gmail.com',
      pass: process.env.SMTP_PASSWORD || '',
    },
  };
});

export type MailConfig = ConfigType<typeof mailConfig>;
