import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { AuthConfig, authConfig } from '../auth.config';
import type { AuthenticatedRequest } from '../interfaces/authenticated-user.interface';
import { readCookie } from '../utils/token.util';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie sessions (in addition to SameSite): state-changing requests must come
 * from an allow-listed Origin. A cookie-bearing request with no Origin/Referer at all is rejected.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(authConfig.KEY) private readonly cfg: AuthConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (SAFE_METHODS.has(req.method)) return true;

    const originHeader = req.headers.origin ?? this.refererOrigin(req.headers.referer);
    const authHeader = req.headers.authorization;
    const hasBearer = !!(authHeader?.startsWith('Bearer ') || authHeader?.startsWith('bearer '));
    const hasSessionCookie = !!readCookie(req.headers.cookie, this.cfg.cookieName);

    if (!originHeader) {
      if (hasSessionCookie && !hasBearer) throw new ForbiddenException('Origin required');
      return true; // non-browser client without a session cookie (e.g. curl login in dev or API token)
    }
    const origin = originHeader.trim().replace(/\/$/, '');
    const isAllowed =
      this.cfg.allowedOrigins.includes(origin) ||
      /^https:\/\/(?:[a-zA-Z0-9-]+\.)*vercel\.app$/.test(origin) ||
      /^https:\/\/(?:[a-zA-Z0-9-]+\.)*mrminfotech\.com$/.test(origin) ||
      /^http:\/\/localhost(:\d+)?$/.test(origin);

    if (!isAllowed) {
      throw new ForbiddenException('Origin not allowed');
    }
    return true;
  }

  private refererOrigin(referer?: string): string | undefined {
    if (!referer) return undefined;
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
}
