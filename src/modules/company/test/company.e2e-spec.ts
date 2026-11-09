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

describe('Company profile PATCH empty-value semantics (regression)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { plainToInstance } = require('class-transformer') as typeof import('class-transformer');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { validate } = require('class-validator') as typeof import('class-validator');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { UpdateCompanyDto } = require('../company/dto/update-company.dto') as typeof import('../company/dto/update-company.dto');

  const actor = { id: 'user-1' } as AuthenticatedUser;
  const prisma = {
    siteSetting: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const service = new CompanyService(prisma as unknown as PrismaService);
  const stored = { name: 'MRM', tagline: 'Old tagline', description: 'Old demo text', phone: '+8801700000000' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.siteSetting.findUnique.mockResolvedValue({ value: stored });
    prisma.siteSetting.update.mockImplementation(({ data }: { data: { value: unknown } }) =>
      Promise.resolve({ key: 'company.profile', value: data.value }),
    );
  });

  const dto = (body: Record<string, unknown>) => plainToInstance(UpdateCompanyDto, body);

  it('turns an empty string into null so the optional field is cleared', async () => {
    const instance = dto({ description: '   ', tagline: '' });
    expect(await validate(instance, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    expect(instance.description).toBeNull();
    const result = await service.save(instance, actor);
    expect((result.value as Record<string, unknown>).description).toBeNull();
    expect((result.value as Record<string, unknown>).tagline).toBeNull();
  });

  it('retains fields that are omitted from the PATCH body', async () => {
    const result = await service.save(dto({ tagline: 'New tagline' }), actor);
    expect(result.value).toEqual({ ...stored, tagline: 'New tagline' });
  });

  it('replaces old text with new text and persists it', async () => {
    const result = await service.save(dto({ description: 'Real description' }), actor);
    expect((result.value as Record<string, unknown>).description).toBe('Real description');
  });

  it('clears foundedYear when sent as an empty string or null', async () => {
    expect(dto({ foundedYear: '' }).foundedYear).toBeNull();
    const instance = dto({ foundedYear: null });
    expect(await validate(instance)).toHaveLength(0);
  });

  it('rejects clearing the required name', async () => {
    const errors = await validate(dto({ name: '' }), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('still validates non-empty optional values', async () => {
    const errors = await validate(dto({ email: 'not-an-email' }));
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});
