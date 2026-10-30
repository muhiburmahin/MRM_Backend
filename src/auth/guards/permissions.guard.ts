import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ANY_AUTHENTICATED_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../auth.constants';
import type { AuthenticatedRequest } from '../interfaces/authenticated-user.interface';

/**
 * Deny by default: a non-public route must declare @Permissions(...) or @AnyAuthenticated().
 * A route that declares nothing is rejected (and logged) so a forgotten decorator can't expose data.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new UnauthorizedException('Authentication required');

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets);
    if (required?.length) {
      if (required.every((p) => user.permissions.includes(p))) return true;
      throw new ForbiddenException('Insufficient permissions');
    }
    if (this.reflector.getAllAndOverride<boolean>(ANY_AUTHENTICATED_KEY, targets)) return true;

    this.logger.warn(`Route ${ctx.getClass().name}.${ctx.getHandler().name} has no authorization metadata; denied`);
    throw new ForbiddenException('Insufficient permissions');
  }
}
