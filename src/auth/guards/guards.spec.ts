import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PASSWORD_CHANGE_KEY, ANY_AUTHENTICATED_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../auth.constants';
import { testCfg, testUser } from '../test-helpers';
import { AuthGuard } from './auth.guard';
import { OriginGuard } from './origin.guard';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from './roles.guard';

const ctx = (req: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => req }), getHandler: () => function handler() {}, getClass: () => class Ctl {} }) as unknown as ExecutionContext;
const reflectorWith = (meta: Record<string, unknown>) => ({ getAllAndOverride: (k: string) => meta[k] }) as unknown as Reflector;

describe('AuthGuard', () => {
  const sessions = { validate: jest.fn() };
  const make = (meta: Record<string, unknown> = {}) => new AuthGuard(reflectorWith(meta), sessions as never, testCfg);
  beforeEach(() => jest.resetAllMocks());

  it('lets @Public routes through without a cookie', async () => {
    expect(await make({ [IS_PUBLIC_KEY]: true }).canActivate(ctx({ headers: {} }))).toBe(true);
  });
  it('rejects a missing cookie', async () => {
    await expect(make().canActivate(ctx({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rejects an invalid session', async () => {
    sessions.validate.mockResolvedValue(null);
    await expect(make().canActivate(ctx({ headers: { cookie: 'mrm_session=bad' } }))).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('attaches the user for a valid session', async () => {
    sessions.validate.mockResolvedValue(testUser());
    const req: Record<string, unknown> = { headers: { cookie: 'mrm_session=good' } };
    expect(await make().canActivate(ctx(req))).toBe(true);
    expect((req.user as { id: string }).id).toBe('u1');
  });
  it('blocks other routes while a password change is required, but not the allowed ones', async () => {
    sessions.validate.mockResolvedValue(testUser({ mustChangePassword: true }));
    const req = () => ({ headers: { cookie: 'mrm_session=good' } });
    await expect(make().canActivate(ctx(req()))).rejects.toBeInstanceOf(ForbiddenException);
    expect(await make({ [ALLOW_PASSWORD_CHANGE_KEY]: true }).canActivate(ctx(req()))).toBe(true);
  });
});

describe('PermissionsGuard', () => {
  const run = (meta: Record<string, unknown>, user?: ReturnType<typeof testUser>) =>
    new PermissionsGuard(reflectorWith(meta)).canActivate(ctx({ user }));

  it('allows @Public', () => expect(run({ [IS_PUBLIC_KEY]: true })).toBe(true));
  it('denies by default when a route declares nothing', () => {
    expect(() => run({}, testUser())).toThrow(ForbiddenException);
  });
  it('allows @AnyAuthenticated', () => expect(run({ [ANY_AUTHENTICATED_KEY]: true }, testUser())).toBe(true));
  it('allows when all permissions are held', () => expect(run({ [PERMISSIONS_KEY]: ['page:read'] }, testUser())).toBe(true));
  it('denies when a permission is missing (403)', () => {
    expect(() => run({ [PERMISSIONS_KEY]: ['page:read', 'page:publish'] }, testUser())).toThrow(ForbiddenException);
  });
  it('never trusts a role name alone', () => {
    expect(() => run({ [PERMISSIONS_KEY]: ['user:write'] }, testUser({ role: { id: 'r', key: 'owner', name: 'Owner' } }))).toThrow(ForbiddenException);
  });
  it('401 when no user is attached', () => expect(() => run({ [PERMISSIONS_KEY]: ['x'] })).toThrow(UnauthorizedException));
});

describe('RolesGuard', () => {
  const run = (meta: Record<string, unknown>, user?: ReturnType<typeof testUser>) =>
    new RolesGuard(reflectorWith(meta)).canActivate(ctx({ user }));

  it('allows matching role names regardless of case', () => {
    expect(run({ 'auth:roles': ['ADMIN'] }, testUser({ role: { id: 'r1', key: 'admin', name: 'Admin' } }))).toBe(true);
  });

  it('denies when the user does not satisfy the required role', () => {
    expect(() => run({ 'auth:roles': ['OWNER'] }, testUser({ role: { id: 'r1', key: 'editor', name: 'Editor' } }))).toThrow(ForbiddenException);
  });

  it('allows access when no role metadata is set', () => expect(run({})).toBe(true));
});

describe('OriginGuard', () => {
  const guard = new OriginGuard(testCfg);
  const post = (headers: Record<string, string>) => ctx({ method: 'POST', headers });
  it('allows safe methods', () => expect(guard.canActivate(ctx({ method: 'GET', headers: {} }))).toBe(true));
  it('allows an allow-listed origin', () => expect(guard.canActivate(post({ origin: 'https://admin.example.com' }))).toBe(true));
  it('rejects a foreign origin', () => expect(() => guard.canActivate(post({ origin: 'https://evil.example' }))).toThrow(ForbiddenException));
  it('rejects a cookie-bearing request with no Origin/Referer', () => {
    expect(() => guard.canActivate(post({ cookie: 'mrm_session=abc' }))).toThrow(ForbiddenException);
  });
  it('uses Referer when Origin is absent', () => {
    expect(guard.canActivate(post({ referer: 'https://admin.example.com/login' }))).toBe(true);
  });
});
