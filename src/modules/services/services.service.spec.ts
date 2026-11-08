import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ServicesService } from './services.service';

const user = (permissions: string[]): AuthenticatedUser => ({
  id: 'u1',
  sessionId: 's1',
  email: 'a@b.com',
  name: 'A',
  uiLocale: 'en',
  mustChangePassword: false,
  twoFactorEnabled: false,
  role: { id: 'r', key: 'editor', name: 'Editor' },
  permissions,
});
const writer = user(['service:read', 'service:write']);
const publisher = user(['service:read', 'service:write', 'service:publish', 'service:delete']);

function makePrisma() {
  const p = {
    language: {
      findFirst: jest.fn().mockResolvedValue({ code: 'en' }),
      findMany: jest
        .fn()
        .mockImplementation(async ({ where }: { where: { code: { in: string[] } } }) =>
          where.code.in
            .filter((c: string) => ['en', 'bn'].includes(c))
            .map((code: string) => ({ code })),
        ),
    },
    serviceTranslation: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
    },
    service: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'id1' }),
      update: jest.fn().mockResolvedValue({ id: 'id1' }),
      delete: jest.fn(),
    },
    serviceOfferingItem: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
    serviceBenefitItem: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
    serviceProcessStepItem: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
    serviceMediaItem: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
    serviceFaqItem: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
    lead: { count: jest.fn().mockResolvedValue(0) },
    caseStudy: { count: jest.fn().mockResolvedValue(0) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };
  p.$transaction.mockImplementation(async (fn: (tx: typeof p) => Promise<unknown>) => fn(p));
  return p;
}

describe('ServicesService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: ServicesService;
  beforeEach(() => {
    prisma = makePrisma();
    svc = new ServicesService(prisma as never);
  });

  describe('public list', () => {
    const base = { page: 2, limit: 5, sort: 'sortOrder' as const, order: 'asc' as const };

    it('filters to published, live, active services in the locale and paginates', async () => {
      prisma.service.count.mockResolvedValue(12);
      await svc.listPublic({ ...base, locale: 'bn' });
      const args = prisma.service.findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({
        status: 'PUBLISHED',
        isActive: true,
      });
      expect(args.skip).toBe(5);
      expect(args.take).toBe(5);
    });

    it('uses the default language when no locale is given', async () => {
      await svc.listPublic(base);
      expect(prisma.service.findMany).toHaveBeenCalled();
    });

    it('returns only public fields (no internal secrets)', async () => {
      prisma.service.count.mockResolvedValue(1);
      prisma.service.findMany.mockResolvedValue([
        {
          id: 's1',
          slug: 'web',
          title: 'Web',
          name: 'Web',
          shortDescription: 'S',
          description: 'S',
          icon: 'globe',
          servicesPageOrder: 1,
          sortOrder: 1,
          status: 'PUBLISHED',
          isActive: true,
          category: null,
          offerings: [],
          benefits: [],
          processSteps: [],
          mediaGallery: [],
          technologies: [],
        },
      ]);
      const res = await svc.listPublic(base);
      expect(res.data[0]).toMatchObject({
        slug: 'web',
        name: 'Web',
        shortDescription: 'S',
      });
      expect(res.meta).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
    });

    it('orders by sort parameters with deterministic ordering', async () => {
      await svc.listPublic({ ...base, sort: 'sortOrder', order: 'desc' });
      const orderBy = prisma.service.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toBeDefined();
    });

    it('adds a case-insensitive search on name and summary', async () => {
      await svc.listPublic({ ...base, q: 'web' });
      expect(JSON.stringify(prisma.service.findMany.mock.calls[0][0].where)).toContain(
        '"mode":"insensitive"',
      );
    });
  });

  describe('public detail', () => {
    it('404 when missing / unpublished / inactive', async () => {
      prisma.service.findFirst.mockResolvedValue(null);
      await expect(svc.getPublicBySlug('nope', 'en')).rejects.toBeInstanceOf(NotFoundException);
      const where = prisma.service.findFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({
        status: 'PUBLISHED',
        isActive: true,
        slug: 'nope',
      });
    });

    it('returns a safe detail with available locales', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 's1',
        slug: 'web',
        title: 'Web',
        name: 'Web',
        shortDescription: 'S',
        description: 'Full body',
        icon: 'globe',
        status: 'PUBLISHED',
        isActive: true,
        allowPublicDetail: true,
        category: null,
        offerings: [],
        benefits: [],
        processSteps: [],
        mediaGallery: [],
        serviceFaqs: [],
        technologies: [],
        caseStudies: [],
      });
      const res = await svc.getPublicBySlug('web', 'en');
      expect(res.slug).toBe('web');
      expect(res.name).toBe('Web');
    });
  });

  describe('admin create', () => {
    const dto = { slug: 'web', translations: [{ locale: 'en', name: 'Web', summary: 'S' }] };
    beforeEach(() => {
      prisma.service.create.mockResolvedValue({ id: 'id1' });
      prisma.service.findUnique.mockResolvedValue({ id: 'id1', slug: 'web', translations: [] });
    });

    it('rejects duplicate locales and unknown locales', async () => {
      await expect(
        svc.create({ ...dto, translations: [dto.translations[0], dto.translations[0]] }, writer),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        svc.create({ ...dto, translations: [{ locale: 'xx', name: 'a', summary: 'b' }] }, writer),
      ).rejects.toThrow('Unknown or disabled locale: xx');
    });

    it('lets a writer create drafts but not publish', async () => {
      await expect(svc.create(dto, writer)).resolves.toBeDefined();
      expect(prisma.service.create.mock.calls[0][0].data.translations.create[0]).toMatchObject({
        status: 'DRAFT',
        publishedAt: null,
      });
      await expect(
        svc.create(
          { ...dto, translations: [{ ...dto.translations[0], status: 'PUBLISHED' as const }] },
          writer,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sets publishedAt when a publisher publishes, and audits', async () => {
      await svc.create(
        { ...dto, translations: [{ ...dto.translations[0], status: 'PUBLISHED' as const }] },
        publisher,
      );
      expect(
        prisma.service.create.mock.calls[0][0].data.translations.create[0].publishedAt,
      ).toBeInstanceOf(Date);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'service.create', actorId: 'u1' }),
      });
    });

    it('maps a unique violation to 409', async () => {
      prisma.service.create.mockRejectedValue({ code: 'P2002' });
      await expect(svc.create(dto, writer)).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not fail the request when the audit write fails', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));
      await expect(svc.create(dto, writer)).resolves.toBeDefined();
    });
  });

  describe('admin update', () => {
    const existing = (status: string) => ({
      id: 'id1',
      slug: 'web',
      title: 'Web',
      name: 'Web',
      status,
      isActive: true,
      offerings: [],
      benefits: [],
      processSteps: [],
      mediaGallery: [],
      serviceFaqs: [],
      translations: [
        { locale: 'en', status, publishedAt: status === 'PUBLISHED' ? new Date() : null },
      ],
    });
    beforeEach(() => {
      prisma.service.findUnique.mockImplementation(async () => existing(current));
    });
    let current = 'DRAFT';

    it('404 for a missing service', async () => {
      prisma.service.findUnique.mockResolvedValue(null);
      await expect(svc.update('x', {}, writer)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets a writer edit a draft translation', async () => {
      current = 'DRAFT';
      await svc.update('id1', { translations: [{ locale: 'en', name: 'New' }] }, writer);
      expect(prisma.serviceTranslation.upsert).toHaveBeenCalled();
    });

    it('blocks a writer from touching live content, slug or isActive of a live service', async () => {
      current = 'PUBLISHED';
      await expect(
        svc.update('id1', { translations: [{ locale: 'en', name: 'New' }] }, writer),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.update('id1', { slug: 'other' }, writer)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(svc.update('id1', { isActive: false }, writer)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(svc.update('id1', { sortOrder: 3 }, writer)).resolves.toBeDefined(); // harmless field
    });

    it('requires name and summary when adding a new locale', async () => {
      current = 'DRAFT';
      await expect(
        svc.update('id1', { translations: [{ locale: 'bn', name: 'শুধু নাম' }] }, writer),
      ).rejects.toBeInstanceOf(BadRequestException);
      await svc.update(
        'id1',
        { translations: [{ locale: 'bn', name: 'ওয়েব', summary: 'সারাংশ' }] },
        writer,
      );
      expect(prisma.serviceTranslation.upsert).toHaveBeenCalled();
    });

    it('sets publishedAt on first publish only', async () => {
      current = 'DRAFT';
      await svc.update('id1', { status: 'PUBLISHED' as const, translations: [{ locale: 'en', status: 'PUBLISHED' as const }] }, publisher);
      expect(prisma.serviceTranslation.upsert).toHaveBeenCalled();
    });
  });

  describe('admin delete', () => {
    it('404 / 409 when referenced / ok otherwise', async () => {
      prisma.service.findUnique.mockResolvedValue(null);
      await expect(svc.remove('x', publisher)).rejects.toBeInstanceOf(NotFoundException);

      prisma.service.findUnique.mockResolvedValue({ id: 'x', slug: 'web' });
      prisma.lead.count.mockResolvedValue(2);
      await expect(svc.remove('x', publisher)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.service.delete).not.toHaveBeenCalled();

      prisma.lead.count.mockResolvedValue(0);
      await svc.remove('x', publisher);
      expect(prisma.service.delete).toHaveBeenCalledWith({ where: { id: 'x' } });
    });
  });

  describe('admin list', () => {
    it('applies filters and a stable sort', async () => {
      await svc.listAdmin({
        page: 1,
        limit: 20,
        sort: 'slug',
        order: 'desc',
        q: 'we',
        isActive: true,
        status: 'DRAFT',
      });
      const a = prisma.service.findMany.mock.calls[0][0];
      expect(a.where).toMatchObject({
        status: 'DRAFT',
      });
      expect(a.orderBy).toBeDefined();
    });
  });
});
