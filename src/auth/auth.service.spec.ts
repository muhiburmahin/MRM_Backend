import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { testCfg, testUser } from './test-helpers';

describe('AuthService', () => {
  const passwords = new PasswordService();
  let hash: string;
  const prisma = { user: { findUnique: jest.fn(), update: jest.fn() }, auditLog: { create: jest.fn() } };
  const sessions = { create: jest.fn(), validate: jest.fn(), revoke: jest.fn(), revokeAllForUser: jest.fn() };
  const attempts = { isLocked: jest.fn(), record: jest.fn() };
  let svc: AuthService;
  const meta = { ip: '1.2.3.4', userAgent: 'jest' };

  beforeAll(async () => { hash = await passwords.hash('a-long-enough-passphrase'); });
  beforeEach(() => {
    jest.resetAllMocks();
    attempts.isLocked.mockResolvedValue(false);
    sessions.create.mockResolvedValue({ token: 'tok', expiresAt: new Date() });
    sessions.validate.mockResolvedValue(testUser());
    svc = new AuthService(prisma as never, passwords, sessions as never, attempts as never, testCfg);
  });
  const userRow = (over = {}) => ({ id: 'u1', passwordHash: hash, isActive: true, deletedAt: null, twoFactorEnabled: false, ...over });

  it('logs in with valid credentials and creates a session', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    const res = await svc.login({ email: 'Admin@Example.com', password: 'a-long-enough-passphrase' }, meta);
    expect(res.session.token).toBe('tok');
    expect(attempts.record).toHaveBeenCalledWith('admin@example.com', expect.any(String), true);
    expect(JSON.stringify(res)).not.toContain(hash);
  });

  it('gives the SAME generic error for wrong password and unknown account', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    const wrong = await svc.login({ email: 'a@b.com', password: 'nope-nope-nope' }, meta).catch((e) => e);
    prisma.user.findUnique.mockResolvedValue(null);
    const unknown = await svc.login({ email: 'x@b.com', password: 'nope-nope-nope' }, meta).catch((e) => e);
    expect(wrong).toBeInstanceOf(UnauthorizedException);
    expect(unknown).toBeInstanceOf(UnauthorizedException);
    expect(wrong.message).toBe(unknown.message);
    expect(attempts.record).toHaveBeenCalledTimes(2);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it.each([['inactive', { isActive: false }], ['deleted', { deletedAt: new Date() }]])('rejects %s accounts generically', async (_n, over) => {
    prisma.user.findUnique.mockResolvedValue(userRow(over));
    await expect(svc.login({ email: 'a@b.com', password: 'a-long-enough-passphrase' }, meta)).rejects.toThrow('Invalid email or password');
  });

  it('fails closed when 2FA is enabled (not implemented yet)', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow({ twoFactorEnabled: true }));
    await expect(svc.login({ email: 'a@b.com', password: 'a-long-enough-passphrase' }, meta)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('returns 429 when locked, before touching the user table', async () => {
    attempts.isLocked.mockResolvedValue(true);
    const err = await svc.login({ email: 'a@b.com', password: 'x' }, meta).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('logout revokes the server-side session', async () => {
    await svc.logout(testUser(), meta);
    expect(sessions.revoke).toHaveBeenCalledWith('s1');
  });

  describe('changePassword', () => {
    it('rejects a wrong current password', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: hash });
      await expect(svc.changePassword(testUser(), { currentPassword: 'bad', newPassword: 'another-long-passphrase' }, meta)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
    it('rejects a policy violation', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: hash });
      await expect(svc.changePassword(testUser(), { currentPassword: 'a-long-enough-passphrase', newPassword: 'aaaaaaaaaaaaaaaa' }, meta)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('updates the hash, clears the flag and revokes other sessions', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: hash });
      await svc.changePassword(testUser(), { currentPassword: 'a-long-enough-passphrase', newPassword: 'another-long-passphrase' }, meta);
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.mustChangePassword).toBe(false);
      expect(data.passwordHash).toMatch(/^\$argon2id\$/);
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u1', 's1');
    });
  });
});
