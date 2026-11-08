import { ConfigType, registerAs } from '@nestjs/config';

const SAME_SITE = ['lax', 'strict', 'none'] as const;
export type SameSiteValue = (typeof SAME_SITE)[number];

function intEnv(name: string, def: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`Invalid ${name}: must be an integer between ${min} and ${max}`);
  }
  return n;
}

/** All auth-related environment lookups live here (single place). Fails fast at startup. */
export const authConfig = registerAs('auth', () => {
  const isProd = process.env.NODE_ENV === 'production';

  const ipHashSalt = process.env.AUTH_IP_HASH_SALT ?? '';
  if (ipHashSalt.length < 16) {
    throw new Error('AUTH_IP_HASH_SALT is required (minimum 16 characters)');
  }

  const sameSite = (process.env.AUTH_COOKIE_SAMESITE ?? 'lax').toLowerCase();
  if (!SAME_SITE.includes(sameSite as SameSiteValue)) {
    throw new Error('AUTH_COOKIE_SAMESITE must be one of: lax, strict, none');
  }

  const secure =
    process.env.AUTH_COOKIE_SECURE !== undefined
      ? process.env.AUTH_COOKIE_SECURE === 'true'
      : isProd;
  if (isProd && !secure) throw new Error('AUTH_COOKIE_SECURE cannot be false in production');
  if (sameSite === 'none' && !secure)
    throw new Error('SameSite=None requires AUTH_COOKIE_SECURE=true');

  const allowedOrigins = (process.env.AUTH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const finalOrigins =
    allowedOrigins.length > 0
      ? allowedOrigins
      : ['http://localhost:3000', 'http://localhost:5000'];

  return {
    isProd,
    cookieName: process.env.AUTH_COOKIE_NAME || 'mrm_session',
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    cookieSecure: secure,
    cookieSameSite: sameSite as SameSiteValue,
    sessionTtlHours: intEnv('AUTH_SESSION_TTL_HOURS', 12, 1, 168),
    maxFailedAttempts: intEnv('AUTH_MAX_FAILED_ATTEMPTS', 5, 3, 20),
    lockoutMinutes: intEnv('AUTH_LOCKOUT_MINUTES', 15, 1, 1440),
    ipHashSalt,
    allowedOrigins: finalOrigins,
  };
});

export type AuthConfig = ConfigType<typeof authConfig>;
