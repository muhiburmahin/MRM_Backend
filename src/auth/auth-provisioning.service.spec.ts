import { AuthProvisioningService } from './auth-provisioning.service';
import { PasswordService } from './password.service';

describe('AuthProvisioningService', () => {
  const passwords = new PasswordService();
  const prisma = {
    user: { count: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    role: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  let svc: AuthProvisioningService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = new AuthProvisioningService(prisma as never, passwords);
  });

  it('refuses to provision when any active user already exists', async () => {
    prisma.user.count.mockResolvedValue(1);

    const result = await svc.provisionOwner({
      email: 'owner@example.com',
      password: 'a-long-enough-passphrase',
    });

    expect(result).toEqual({
      created: false,
      reason: 'A user already exists; first-owner provisioning is disabled.',
    });
    expect(prisma.role.findUnique).not.toHaveBeenCalled();
  });

  it('creates the first owner once and stores a hashed password', async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.role.findUnique.mockResolvedValue({ id: 'role-owner', key: 'owner' });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u-owner' });

    const result = await svc.provisionOwner({
      email: 'owner@example.com',
      password: 'a-long-enough-passphrase',
      name: 'Initial Owner',
    });

    expect(result).toEqual({ created: true });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'owner@example.com',
          name: 'Initial Owner',
          roleId: 'role-owner',
          passwordHash: expect.stringMatching(/^\$argon2id\$/),
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'user.owner_provisioned' }),
      }),
    );
  });
});
