import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  email: string;
  name: string;
  uiLocale: string;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  role: { id: string; key: string; name: string };
  /** permission keys, e.g. "lead:read" (loaded server-side from DB on every request) */
  permissions: string[];
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}
