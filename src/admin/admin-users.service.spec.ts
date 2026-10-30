import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AdminUsersService } from './admin-users.service';
import { hashToken } from '../auth/utils/token.util';

describe('AdminUsersService', () => {
  const actor: AuthenticatedUser = {
    id: 'actor-id',
    sessionId: 'session-id',
    email: 'admin@example.com',
    name: 'Admin',
    uiLocale: 'en',
    mustChangePassword: false,
    twoFactorEnabled: false,
    role: { id: 'admin-role', key: 'admin', name: 'Administrator' },
    permissions: ['user:invite', 'user:write'],
  };
  const tx = {
    userInvite: { create: jest.fn(), updateMany: jest.fn() },
    user: { findFirst: jest.fn(), create: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    userInvite: { findUnique: jest.fn() },
    role: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const passwords = {
    validatePolicy: jest.fn(),
    hash: jest.fn(),
  };
  let service: AdminUsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    passwords.validatePolicy.mockReturnValue([]);
    passwords.hash.mockResolvedValue('argon-hash');
    service = new AdminUsersService(prisma as never, passwords as never);
  });

  it('does not allow a non-owner to invite a role with higher privileges', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({
      id: 'owner-role',
      key: 'owner',
      permissions: [{ permission: { key: 'role:write' } }],
    });

    await expect(
      service.invite({ email: 'new@example.com', roleId: 'owner-role', expiresInHours: 72 }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('stores only the token hash and returns the plaintext invite token once', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({
      id: 'editor-role',
      key: 'editor',
      permissions: [{ permission: { key: 'user:write' } }],
    });
    const safeInvite = {
      id: 'invite-id',
      email: 'new@example.com',
      role: { id: 'editor-role', key: 'editor', name: 'Editor' },
      expiresAt: new Date(Date.now() + 72 * 3_600_000),
      createdAt: new Date(),
    };
    tx.userInvite.create.mockResolvedValue(safeInvite);
    tx.auditLog.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );

    const result = await service.invite(
      { email: ' NEW@example.com ', roleId: 'editor-role', expiresInHours: 72 },
      actor,
    );

    expect(result).toMatchObject(safeInvite);
    expect(typeof result.token).toBe('string');
    expect(tx.userInvite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@example.com',
          tokenHash: hashToken(result.token),
        }),
      }),
    );
    expect(tx.userInvite.create.mock.calls[0][0].data.tokenHash).not.toBe(result.token);
  });

  it('accepts an invite once and stores only the password hash', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    prisma.userInvite.findUnique.mockResolvedValue({
      id: 'invite-id',
      email: 'new@example.com',
      roleId: 'editor-role',
      expiresAt,
      acceptedAt: null,
    });
    tx.user.findFirst.mockResolvedValue(null);
    tx.userInvite.updateMany.mockResolvedValue({ count: 1 });
    tx.user.create.mockResolvedValue({ id: 'new-user-id', email: 'new@example.com' });
    tx.auditLog.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );

    await expect(
      service.acceptInvite({
        token: 'a'.repeat(43),
        password: 'long-secure-passphrase',
        name: 'New User',
      }),
    ).resolves.toEqual({ id: 'new-user-id', email: 'new@example.com' });
    expect(tx.userInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'invite-id', acceptedAt: null, expiresAt: { gt: expect.any(Date) } },
      }),
    );
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: 'argon-hash', roleId: 'editor-role' }),
      }),
    );
    expect(JSON.stringify(tx.user.create.mock.calls[0][0])).not.toContain('long-secure-passphrase');
  });

  it('rejects invalid or expired invitation tokens', async () => {
    prisma.userInvite.findUnique.mockResolvedValue(null);

    await expect(
      service.acceptInvite({
        token: 'a'.repeat(43),
        password: 'long-secure-passphrase',
        name: 'New User',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
