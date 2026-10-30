import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { CompanyService } from '../company/company.service';

describe('CompanyService', () => {
  const actor = { id: 'user-1' } as AuthenticatedUser;
  const prisma = {
    siteSetting: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  };
  const service = new CompanyService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('exposes the company profile only when its site setting is public', async () => {
    prisma.siteSetting.findUnique.mockResolvedValue({
      isPublic: false,
      value: { name: 'Private' },
    });
    await expect(service.getPublic()).rejects.toBeInstanceOf(NotFoundException);
    prisma.siteSetting.findUnique.mockResolvedValue({ isPublic: true, value: { name: 'MRM' } });
    await expect(service.getPublic()).resolves.toEqual({ name: 'MRM' });
  });

  it('merges partial changes using the SiteSetting contract and records the actor', async () => {
    prisma.siteSetting.findUnique.mockResolvedValue({
      value: { name: 'MRM', tagline: 'Old' },
    });
    prisma.siteSetting.update.mockResolvedValue({ key: 'company.profile' });
    await service.save({ tagline: 'New' }, actor);
    expect(prisma.siteSetting.update).toHaveBeenCalledWith({
      where: { key: 'company.profile' },
      data: { value: { name: 'MRM', tagline: 'New' }, updatedById: 'user-1' },
    });
  });
});
