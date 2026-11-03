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
  const enabled = process.env.MAIL_ENABLED === 'true';
  const from = process.env.MAIL_FROM || 'MRM InfoTech <no-reply@mrminfotech.com>';
  const notifyRecipient = process.env.MAIL_NOTIFY_RECIPIENT || 'leads@mrminfotech.com';

  return {
    enabled,
    from,
    notifyRecipient,
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: intEnv('SMTP_PORT', 587, 1, 65535),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASSWORD || '',
    },
  };
});

export type MailConfig = ConfigType<typeof mailConfig>;
