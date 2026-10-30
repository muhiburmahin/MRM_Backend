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
      update: jest.fn(),
      create: jest.fn(),
    },
    service: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
      prisma.serviceTranslation.count.mockResolvedValue(12);
      await svc.listPublic({ ...base, locale: 'bn' });
      const args = prisma.serviceTranslation.findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({
        locale: 'bn',
        status: 'PUBLISHED',
        service: { isActive: true },
      });
      expect(args.skip).toBe(5);
      expect(args.take).toBe(5);
    });

    it('uses the default language when no locale is given', async () => {
      await svc.listPublic(base);
      expect(prisma.serviceTranslation.findMany.mock.calls[0][0].where.locale).toBe('en');
    });

    it('returns only public fields (no ids, no status)', async () => {
      prisma.serviceTranslation.count.mockResolvedValue(1);
      prisma.serviceTranslation.findMany.mockResolvedValue([
        {
          name: 'Web',
          summary: 'S',
          publishedAt: null,
          service: { slug: 'web', icon: 'globe', sortOrder: 1 },
        },
      ]);
      const res = await svc.listPublic(base);
      expect(res.data[0]).toEqual({
        slug: 'web',
        icon: 'globe',
        sortOrder: 1,
        name: 'Web',
        summary: 'S',
        publishedAt: null,
      });
      expect(res.meta).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
    });

    it.each([['sortOrder'], ['name'], ['publishedAt']] as const)(
      'orders by %s with a deterministic tie-breaker',
      async (sort) => {
        await svc.listPublic({ ...base, sort, order: 'desc' });
        const orderBy = prisma.serviceTranslation.findMany.mock.calls[0][0].orderBy;
        expect(orderBy).toHaveLength(2);
        expect(orderBy[1]).toEqual({ service: { slug: 'asc' } });
      },
    );

    it('adds a case-insensitive search on name and summary', async () => {
      await svc.listPublic({ ...base, q: 'web' });
      expect(JSON.stringify(prisma.serviceTranslation.findMany.mock.calls[0][0].where)).toContain(
        '"mode":"insensitive"',
      );
    });
  });

  describe('public detail', () => {
    it('404 when missing / unpublished / inactive', async () => {
      prisma.serviceTranslation.findFirst.mockResolvedValue(null);
      await expect(svc.getPublicBySlug('nope', 'en')).rejects.toBeInstanceOf(NotFoundException);
      const where = prisma.serviceTranslation.findFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({
        status: 'PUBLISHED',
        service: { isActive: true, slug: 'nope' },
      });
    });

    it('returns a safe detail with available locales', async () => {
      prisma.serviceTranslation.findFirst.mockResolvedValue({
        locale: 'en',
        name: 'Web',
        summary: 'S',
        body: { a: 1 },
        publishedAt: null,
        seoTitle: null,
        seoDescription: null,
        service: {
          slug: 'web',
          icon: null,
          sortOrder: 0,
          translations: [{ locale: 'en' }, { locale: 'bn' }],
        },
      });
      const res = await svc.getPublicBySlug('web', 'en');
      expect(res.availableLocales).toEqual(['bn', 'en']);
      expect(res).not.toHaveProperty('id');
      expect(res).not.toHaveProperty('status');
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
      isActive: true,
      translations: [
        { locale: 'en', status, publishedAt: status === 'PUBLISHED' ? new Date() : null },
      ],
    });
    beforeEach(() => {
      prisma.service.findUnique.mockImplementation(
        async (a: { select?: { translations?: { select?: { status?: boolean } } } }) =>
          a.select?.translations?.select?.status ? existing(current) : { id: 'id1' },
      );
    });
    let current = 'DRAFT';

    it('404 for a missing service', async () => {
      prisma.service.findUnique.mockResolvedValue(null);
      await expect(svc.update('x', {}, writer)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets a writer edit a draft translation', async () => {
      current = 'DRAFT';
      await svc.update('id1', { translations: [{ locale: 'en', name: 'New' }] }, writer);
      expect(prisma.serviceTranslation.update).toHaveBeenCalledWith({
        where: { serviceId_locale: { serviceId: 'id1', locale: 'en' } },
        data: { name: 'New' },
      });
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
      expect(prisma.serviceTranslation.create).toHaveBeenCalled();
    });

    it('sets publishedAt on first publish only', async () => {
      current = 'DRAFT';
      await svc.update('id1', { translations: [{ locale: 'en', status: 'PUBLISHED' }] }, publisher);
      expect(prisma.serviceTranslation.update.mock.calls[0][0].data.publishedAt).toBeInstanceOf(
        Date,
      );
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
        isActive: true,
        translations: { some: { status: 'DRAFT' } },
      });
      expect(a.orderBy).toEqual([{ slug: 'desc' }, { id: 'asc' }]);
    });
  });
});
