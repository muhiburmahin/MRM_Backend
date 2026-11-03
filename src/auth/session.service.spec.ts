import { SessionService } from './session.service';
import { testCfg } from './test-helpers';
import { hashToken } from './utils/token.util';

const sessionRow = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  user: {
    id: 'u1',
    email: 'a@b.com',
    name: 'A',
    uiLocale: 'en',
    isActive: true,
    deletedAt: null,
    mustChangePassword: false,
    twoFactorEnabled: false,
    passwordHash: 'SECRET',
    role: {
      id: 'r',
      key: 'editor',
      name: 'Editor',
      permissions: [{ permission: { key: 'page:read' } }],
    },
  },
  ...over,
});

describe('SessionService', () => {
  const prisma = {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const svc = new SessionService(prisma as never, testCfg);
  beforeEach(() => jest.clearAllMocks());

  it('stores only the token hash, never the token', async () => {
    const { token } = await svc.create('u1', { ip: '1.2.3.4', userAgent: 'jest' });
    const data = prisma.session.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(data)).not.toContain(token);
    expect(data.ipHash).toBeDefined();
    expect(JSON.stringify(data)).not.toContain('1.2.3.4');
  });

  it('validates a good session and returns safe fields only', async () => {
    prisma.session.findUnique.mockResolvedValue(sessionRow());
    const user = await svc.validate('tok');
    expect(user).toMatchObject({ id: 'u1', permissions: ['page:read'], role: { key: 'editor' } });
    expect(JSON.stringify(user)).not.toContain('SECRET');
  });

  it.each([
    ['unknown', null],
    ['revoked', sessionRow({ revokedAt: new Date() })],
    ['expired', sessionRow({ expiresAt: new Date(Date.now() - 1) })],
    ['inactive user', sessionRow({ user: { ...sessionRow().user, isActive: false } })],
    ['deleted user', sessionRow({ user: { ...sessionRow().user, deletedAt: new Date() } })],
  ])('rejects %s sessions', async (_n, row) => {
    prisma.session.findUnique.mockResolvedValue(row);
    expect(await svc.validate('tok')).toBeNull();
  });

  it('revokeAllForUser keeps the excepted session', async () => {
    await svc.revokeAllForUser('u1', 's1');
    expect(prisma.session.updateMany.mock.calls[0][0].where).toMatchObject({
      userId: 'u1',
      id: { not: 's1' },
    });
  });
});
