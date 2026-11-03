import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TwoFactorService } from './two-factor.service';
import { testCfg, testUser } from './test-helpers';

describe('AuthService', () => {
  const passwords = new PasswordService();
  const twoFactor = new TwoFactorService(testCfg);
  let hash: string;
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    recoveryCode: {
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    passwordReset: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const sessions = {
    create: jest.fn(),
    validate: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };
  const attempts = { isLocked: jest.fn(), record: jest.fn() };
  let svc: AuthService;
  const meta = { ip: '1.2.3.4', userAgent: 'jest' };

  beforeAll(async () => {
    hash = await passwords.hash('a-long-enough-passphrase');
  });

  beforeEach(() => {
    jest.resetAllMocks();
    attempts.isLocked.mockResolvedValue(false);
    sessions.create.mockResolvedValue({ token: 'tok', expiresAt: new Date() });
    sessions.validate.mockResolvedValue(testUser());
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(prisma)
        : Promise.all(arg as Promise<unknown>[]),
    );
    svc = new AuthService(
      prisma as never,
      passwords,
      sessions as never,
      attempts as never,
      twoFactor,
      testCfg,
    );
  });

  const userRow = (over = {}) => ({
    id: 'u1',
    email: 'admin@example.com',
    passwordHash: hash,
    isActive: true,
    deletedAt: null,
    twoFactorEnabled: false,
    twoFactorSecretEnc: null,
    ...over,
  });

  it('logs in with valid credentials and creates a session', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    const res = await svc.login(
      { email: 'Admin@Example.com', password: 'a-long-enough-passphrase' },
      meta,
    );
    expect(res.requiresTwoFactor).toBe(false);
    if (!res.requiresTwoFactor) {
      expect(res.session.token).toBe('tok');
    }
    expect(attempts.record).toHaveBeenCalledWith('admin@example.com', expect.any(String), true);
    expect(JSON.stringify(res)).not.toContain(hash);
  });

  it('gives the SAME generic error for wrong password and unknown account', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    const wrong = await svc
      .login({ email: 'a@b.com', password: 'nope-nope-nope' }, meta)
      .catch((e) => e);
    prisma.user.findUnique.mockResolvedValue(null);
    const unknown = await svc
      .login({ email: 'x@b.com', password: 'nope-nope-nope' }, meta)
      .catch((e) => e);
    expect(wrong).toBeInstanceOf(UnauthorizedException);
    expect(unknown).toBeInstanceOf(UnauthorizedException);
    expect(wrong.message).toBe(unknown.message);
    expect(attempts.record).toHaveBeenCalledTimes(2);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it.each([
    ['inactive', { isActive: false }],
    ['deleted', { deletedAt: new Date() }],
  ])('rejects %s accounts generically', async (_n, over) => {
    prisma.user.findUnique.mockResolvedValue(userRow(over));
    await expect(
      svc.login({ email: 'a@b.com', password: 'a-long-enough-passphrase' }, meta),
    ).rejects.toThrow('Invalid email or password');
  });

  it('returns a two-factor challenge when 2FA is active and no code is provided', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow({ twoFactorEnabled: true }));
    const res = await svc.login({ email: 'a@b.com', password: 'a-long-enough-passphrase' }, meta);
    expect(res.requiresTwoFactor).toBe(true);
    if (res.requiresTwoFactor) {
      expect(res.twoFactorTicket).toBeDefined();
    }
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('allows direct 2FA login when valid twoFactorCode is provided', async () => {
    const { secret } = twoFactor.generateSecret('a@b.com');
    const validCode = twoFactor.generateTotp(secret);
    const enc = twoFactor.encryptSecret(secret);

    prisma.user.findUnique.mockResolvedValue(
      userRow({ twoFactorEnabled: true, twoFactorSecretEnc: enc }),
    );

    const res = await svc.login(
      { email: 'a@b.com', password: 'a-long-enough-passphrase', twoFactorCode: validCode },
      meta,
    );
    expect(res.requiresTwoFactor).toBe(false);
    expect(sessions.create).toHaveBeenCalled();
  });

  it('rejects direct 2FA login when invalid twoFactorCode is provided', async () => {
    const { secret } = twoFactor.generateSecret('a@b.com');
    const enc = twoFactor.encryptSecret(secret);

    prisma.user.findUnique.mockResolvedValue(
      userRow({ twoFactorEnabled: true, twoFactorSecretEnc: enc }),
    );
    prisma.recoveryCode.findFirst.mockResolvedValue(null);

    await expect(
      svc.login(
        { email: 'a@b.com', password: 'a-long-enough-passphrase', twoFactorCode: '000000' },
        meta,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('verifies pending twoFactorTicket with valid TOTP code in verifyTwoFactorLogin', async () => {
    const { secret } = twoFactor.generateSecret('a@b.com');
    const validCode = twoFactor.generateTotp(secret);
    const enc = twoFactor.encryptSecret(secret);

    prisma.user.findUnique.mockResolvedValue(
      userRow({ twoFactorEnabled: true, twoFactorSecretEnc: enc }),
    );

    const ticket = twoFactor.createTwoFactorTicket('u1', 'a@b.com');
    const res = await svc.verifyTwoFactorLogin({ twoFactorTicket: ticket, code: validCode }, meta);
    expect(res.session.token).toBe('tok');
    expect(sessions.create).toHaveBeenCalled();
  });

  it('allows recovery code login and marks the code as used (single-use)', async () => {
    const rawRecoveryCode = 'a1b2-c3d4';
    const codeHash = twoFactor.hashRecoveryCode(rawRecoveryCode);

    prisma.user.findUnique.mockResolvedValue(
      userRow({ twoFactorEnabled: true, twoFactorSecretEnc: null }),
    );
    prisma.recoveryCode.findFirst.mockResolvedValue({ id: 'rec-1', codeHash, usedAt: null });

    const ticket = twoFactor.createTwoFactorTicket('u1', 'a@b.com');
    const res = await svc.verifyTwoFactorLogin(
      { twoFactorTicket: ticket, code: rawRecoveryCode },
      meta,
    );
    expect(res.session.token).toBe('tok');
    expect(prisma.recoveryCode.update).toHaveBeenCalledWith({
      where: { id: 'rec-1' },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('rejects verifyTwoFactorLogin with expired ticket', async () => {
    await expect(
      svc.verifyTwoFactorLogin({ twoFactorTicket: 'invalid-ticket', code: '123456' }, meta),
    ).rejects.toBeInstanceOf(UnauthorizedException);
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

  describe('Two-Factor Setup and Management', () => {
    it('enables 2FA upon verifying valid code and returns 8 recovery codes', async () => {
      const { secret } = twoFactor.generateSecret('admin@example.com');
      const validCode = twoFactor.generateTotp(secret);
      const enc = twoFactor.encryptSecret(secret);

      prisma.user.findUnique.mockResolvedValue({ twoFactorSecretEnc: enc });

      const res = await svc.enableTwoFactor(testUser(), validCode, meta);
      expect(res.recoveryCodes).toHaveLength(8);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { twoFactorEnabled: true },
      });
      expect(prisma.recoveryCode.createMany).toHaveBeenCalled();
    });

    it('rejects enabling 2FA with invalid verification code', async () => {
      const { secret } = twoFactor.generateSecret('admin@example.com');
      const enc = twoFactor.encryptSecret(secret);

      prisma.user.findUnique.mockResolvedValue({ twoFactorSecretEnc: enc });

      await expect(svc.enableTwoFactor(testUser(), '000000', meta)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('disables 2FA with valid password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        passwordHash: hash,
        twoFactorSecretEnc: null,
      });

      await svc.disableTwoFactor(testUser(), { password: 'a-long-enough-passphrase' }, meta);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { twoFactorEnabled: false, twoFactorSecretEnc: null },
      });
      expect(prisma.recoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('rejects disabling 2FA with wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: hash });

      await expect(
        svc.disableTwoFactor(testUser(), { password: 'wrong-password' }, meta),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('rejects a wrong current password', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: hash });
      await expect(
        svc.changePassword(
          testUser(),
          { currentPassword: 'bad', newPassword: 'another-long-passphrase' },
          meta,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a policy violation', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: hash });
      await expect(
        svc.changePassword(
          testUser(),
          { currentPassword: 'a-long-enough-passphrase', newPassword: 'aaaaaaaaaaaaaaaa' },
          meta,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates the hash, clears the flag and revokes other sessions', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: hash });
      await svc.changePassword(
        testUser(),
        { currentPassword: 'a-long-enough-passphrase', newPassword: 'another-long-passphrase' },
        meta,
      );
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.mustChangePassword).toBe(false);
      expect(data.passwordHash).toMatch(/^\$argon2id\$/);
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u1', 's1');
    });
  });

  describe('passwordReset', () => {
    it('returns generic message on forgotPassword whether user exists or not', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await svc.requestPasswordReset({ email: 'nonexistent@example.com' }, meta);
      expect(res.message).toContain('If an account exists');
      expect(prisma.passwordReset.create).not.toHaveBeenCalled();

      prisma.user.findUnique.mockResolvedValue(userRow());
      prisma.passwordReset.deleteMany.mockResolvedValue({ count: 0 });
      prisma.passwordReset.create.mockResolvedValue({});
      const res2 = await svc.requestPasswordReset({ email: 'admin@example.com' }, meta);
      expect(res2.message).toContain('If an account exists');
      expect(prisma.passwordReset.create).toHaveBeenCalled();
    });

    it('rejects invalid or expired reset token', async () => {
      prisma.passwordReset.findUnique.mockResolvedValue(null);
      await expect(
        svc.resetPasswordWithToken(
          { token: 'invalid_token_here_123', newPassword: 'another-long-passphrase' },
          meta,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      prisma.passwordReset.findUnique.mockResolvedValue({
        id: 'pr-1',
        userId: 'u1',
        expiresAt: new Date(Date.now() - 10000), // expired
        usedAt: null,
        user: userRow(),
      });
      await expect(
        svc.resetPasswordWithToken(
          { token: 'expired_token_here_123', newPassword: 'another-long-passphrase' },
          meta,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('resets password with valid token and revokes all sessions', async () => {
      prisma.passwordReset.findUnique.mockResolvedValue({
        id: 'pr-1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 60000),
        usedAt: null,
        user: userRow(),
      });
      prisma.user.update.mockResolvedValue({});
      prisma.passwordReset.update.mockResolvedValue({});

      const res = await svc.resetPasswordWithToken(
        { token: 'valid_token_here_123', newPassword: 'another-long-passphrase' },
        meta,
      );
      expect(res.message).toContain('Password has been reset successfully');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({ mustChangePassword: false }),
        }),
      );
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u1');
    });
  });
});
