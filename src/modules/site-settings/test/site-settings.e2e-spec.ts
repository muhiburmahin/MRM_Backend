import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { SiteSettingsService } from '../site-settings/site-settings.service';

describe('SiteSettingsService', () => {
  const actor = { id: 'user-1' } as AuthenticatedUser;
  const prisma = {
    siteSetting: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  };
  const service = new SiteSettingsService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('returns only public keys and selects no actor metadata', async () => {
    prisma.siteSetting.findMany.mockResolvedValue([]);
    await service.getPublic();
    expect(prisma.siteSetting.findMany).toHaveBeenCalledWith({
      where: { isPublic: true },
      select: { key: true, group: true, value: true, updatedAt: true },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  });

  it('rejects non-JSON values before writing', async () => {
    await expect(
      service.create({ key: 'site.invalid', value: Number.NaN }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.siteSetting.create).not.toHaveBeenCalled();
  });

  it('requires a setting to exist before updating', async () => {
    prisma.siteSetting.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { value: {} }, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.siteSetting.update).not.toHaveBeenCalled();
  });
});
