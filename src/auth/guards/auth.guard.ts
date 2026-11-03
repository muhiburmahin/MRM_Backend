import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PASSWORD_CHANGE_KEY, IS_PUBLIC_KEY } from '../auth.constants';
import { AuthConfig, authConfig } from '../auth.config';
import type { AuthenticatedRequest } from '../interfaces/authenticated-user.interface';
import { SessionService } from '../session.service';
import { readCookie } from '../utils/token.util';

/** Global guard: every route requires a valid session unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    @Inject(authConfig.KEY) private readonly cfg: AuthConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(req.headers.cookie, this.cfg.cookieName);
    if (!token) throw new UnauthorizedException('Authentication required');

    const user = await this.sessions.validate(token);
    if (!user) throw new UnauthorizedException('Authentication required');

    req.user = user;

    if (
      user.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_KEY, targets)
    ) {
      throw new ForbiddenException({
        message: 'Password change required',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }
    return true;
  }
}
