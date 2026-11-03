import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  ALLOW_PASSWORD_CHANGE_KEY,
  ANY_AUTHENTICATED_KEY,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
} from '../auth.constants';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../interfaces/authenticated-user.interface';

/** Route is reachable without a session. Use sparingly and deliberately. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Route requires ALL listed permission keys (e.g. @Permissions('lead:read')). */
export const Permissions = (...keys: string[]) => SetMetadata(PERMISSIONS_KEY, keys);

/** Route needs a valid session but no specific permission (e.g. /auth/me). Must be explicit. */
export const AnyAuthenticated = () => SetMetadata(ANY_AUTHENTICATED_KEY, true);

/** Allow the route while the user is still forced to change their password. */
export const AllowWhenPasswordChangeRequired = () => SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) throw new Error('CurrentUser used on a route without authentication');
    return req.user;
  },
);
