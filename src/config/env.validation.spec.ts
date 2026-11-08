import { validateEnv } from './env.validation';

const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('validateEnv', () => {
  it('applies safe defaults', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGINS).toBe('');
    expect(env.TRUST_PROXY).toBe(0);
    expect(env.APP_TIMEZONE).toBe('Asia/Dhaka');
    expect(env.TZ).toBe('Asia/Dhaka');
  });

  it('converts numeric and boolean strings', () => {
    const env = validateEnv({ ...base, PORT: '8080', SWAGGER_ENABLED: 'true', TRUST_PROXY: '1' });
    expect(env.PORT).toBe(8080);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.TRUST_PROXY).toBe(1);
  });

  it('treats empty strings as unset', () => {
    expect(validateEnv({ ...base, PORT: '' }).PORT).toBe(4000);
  });

  it('fails when DATABASE_URL is missing', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects invalid values without echoing them', () => {
    const secret = 'super-secret-value';
    try {
      validateEnv({ ...base, NODE_ENV: secret });
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).toMatch(/NODE_ENV/);
      expect((e as Error).message).not.toContain(secret);
    }
  });

  it('rejects invalid timezone and non-origin CORS or auth values', () => {
    expect(() => validateEnv({ ...base, APP_TIMEZONE: 'not/a-timezone' })).toThrow(/APP_TIMEZONE/);
    expect(() => validateEnv({ ...base, CORS_ORIGINS: 'https://example.com/api' })).toThrow(
      /CORS_ORIGINS/,
    );
    expect(() => validateEnv({ ...base, AUTH_ALLOWED_ORIGINS: 'https://example.com/api' })).toThrow(
      /AUTH_ALLOWED_ORIGINS/,
    );
  });

  it('normalizes Vercel / AWS Lambda :UTC and quoted timezones safely', () => {
    const envLambda = validateEnv({ ...base, TZ: ':UTC' });
    expect(envLambda.TZ).toBe('UTC');

    const envQuoted = validateEnv({ ...base, TZ: '"Asia/Dhaka"' });
    expect(envQuoted.TZ).toBe('Asia/Dhaka');

    const envInvalidTz = validateEnv({ ...base, TZ: 'invalid-platform-tz' });
    expect(envInvalidTz.TZ).toBe('Asia/Dhaka');
  });
});
