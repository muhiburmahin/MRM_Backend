import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AdminRolesService } from './admin-roles.service';

describe('AdminRolesService', () => {
  const actor: AuthenticatedUser = {
    id: 'actor-id',
    sessionId: 'session-id',
    email: 'admin@example.com',
    name: 'Admin',
    uiLocale: 'en',
    mustChangePassword: false,
    twoFactorEnabled: false,
    role: { id: 'admin-role', key: 'admin', name: 'Administrator' },
    permissions: ['role:write', 'user:read'],
  };
  const tx = {
    permission: { findMany: jest.fn() },
    role: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
  });

  it('rejects granting permissions the acting user does not have', async () => {
    tx.permission.findMany.mockResolvedValue([{ id: 'permission-id', key: 'user:delete' }]);
    const service = new AdminRolesService(prisma as never);

    await expect(
      service.create(
        {
          key: 'privileged',
          name: 'Privileged',
          permissionKeys: ['user:delete'],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.role.create).not.toHaveBeenCalled();
  });
});
