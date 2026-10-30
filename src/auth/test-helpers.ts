import type { AuthConfig } from './auth.config';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';

export const testCfg: AuthConfig = {
  isProd: false, cookieName: 'mrm_session', cookieDomain: undefined, cookieSecure: false, cookieSameSite: 'lax',
  sessionTtlHours: 12, maxFailedAttempts: 5, lockoutMinutes: 15, ipHashSalt: 'test-salt-test-salt', allowedOrigins: ['https://admin.example.com'],
};

export const testUser = (over: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'u1', sessionId: 's1', email: 'admin@example.com', name: 'Admin', uiLocale: 'en',
  mustChangePassword: false, twoFactorEnabled: false,
  role: { id: 'r1', key: 'editor', name: 'Editor' }, permissions: ['page:read'], ...over,
});
