import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../interfaces/authenticated-user.interface';

const ROLES_KEY = 'auth:roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRole = String(req.user?.role?.key ?? '').toLowerCase();
    const allowed = roles.map((role) => role.toLowerCase());

    if (allowed.includes(userRole)) return true;
    throw new ForbiddenException('Insufficient role privileges');
  }
}
