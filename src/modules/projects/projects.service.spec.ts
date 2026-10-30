import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ProjectsService } from './projects.service';
import { visibility } from './projects.visibility';

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
const writer = user(['casestudy:read', 'casestudy:write']);
const publisher = user([
  'casestudy:read',
  'casestudy:write',
  'casestudy:publish',
  'casestudy:delete',
]);
const past = new Date(Date.now() - 86_400_000);
const future = new Date(Date.now() + 86_400_000);

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
    caseStudyTranslation: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    caseStudy: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    mediaAsset: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'm1' }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };
  p.$transaction.mockImplementation(async (fn: (tx: typeof p) => Promise<unknown>) => fn(p));
  return p;
}

describe('visibility()', () => {
  const ok = {
    isVerified: true,
    evidenceNote: 'Signed approval email',
    publishedAt: past,
    clientId: null,
    clientApprovedAt: null,
    translations: [
      { locale: 'en', status: 'PUBLISHED' },
      { locale: 'bn', status: 'DRAFT' },
    ],
  };
  it('is public only when every condition holds', () => {
    expect(visibility(ok)).toEqual({ isPublic: true, locales: ['en'], blockers: [] });
  });
  it.each([
    ['NOT_VERIFIED', { isVerified: false }],
    ['EVIDENCE_NOTE_MISSING', { evidenceNote: '  ' }],
    ['PUBLISH_DATE_MISSING', { publishedAt: null }],
    ['PUBLISH_DATE_IN_FUTURE', { publishedAt: future }],
    ['CLIENT_APPROVAL_MISSING', { clientId: 'c1' }],
    ['NO_PUBLISHED_TRANSLATION', { translations: [{ locale: 'en', status: 'DRAFT' }] }],
  ])('reports %s', (code, over) => {
    const v = visibility({ ...ok, ...over });
    expect(v.isPublic).toBe(false);
    expect(v.blockers).toContain(code);
    expect(v.locales).toEqual([]);
  });
  it('a linked client needs approval but approval unlocks it', () => {
    expect(visibility({ ...ok, clientId: 'c1', clientApprovedAt: past }).isPublic).toBe(true);
  });
});

describe('ProjectsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: ProjectsService;
  beforeEach(() => {
    prisma = makePrisma();
    svc = new ProjectsService(prisma as never);
  });
  const base = { page: 1, limit: 9, sort: 'sortOrder' as const, order: 'asc' as const };

  describe('public list', () => {
    it('applies the full trust rule in the query (verified, evidence, go-live date, client approval, PUBLISHED, locale)', async () => {
      await svc.listPublic({ ...base, locale: 'bn', page: 2, limit: 3 });
      const a = prisma.caseStudyTranslation.findMany.mock.calls[0][0];
      expect(a.where).toMatchObject({
        locale: 'bn',
        status: 'PUBLISHED',
        caseStudy: { isVerified: true },
      });
      const and = JSON.stringify(a.where.caseStudy.AND);
      expect(and).toContain('"evidenceNote":{"not":null}');
      expect(and).toContain('"evidenceNote":{"not":""}');
      expect(and).toContain('"publishedAt":{"not":null}');
      expect(and).toContain('"lte"');
      expect(and).toContain('"clientId":null');
      expect(and).toContain('"clientApprovedAt":{"not":null}');
      expect(a.skip).toBe(3);
      expect(a.take).toBe(3);
    });

    it('uses the default language when none is given; supports filters, search and deterministic ordering', async () => {
      await svc.listPublic({
        ...base,
        service: 'web-development',
        industry: 'education',
        product: 'edumanage-bd',
        q: 'school',
        sort: 'title',
      });
      const a = prisma.caseStudyTranslation.findMany.mock.calls[0][0];
      expect(a.where.locale).toBe('en');
      expect(a.where.caseStudy).toMatchObject({
        service: { slug: 'web-development' },
        industry: { slug: 'education' },
        product: { slug: 'edumanage-bd' },
      });
      expect(a.where.OR).toBeDefined();
      expect(a.orderBy[1]).toEqual({ caseStudy: { slug: 'asc' } });
    });

    it('never selects internal fields', async () => {
      await svc.listPublic(base);
      const csSelect =
        prisma.caseStudyTranslation.findMany.mock.calls[0][0].select.caseStudy.select;
      // the case study's own internal fields are never selected (the client's flags are used only to decide disclosure)
      for (const k of [
        'id',
        'evidenceNote',
        'isVerified',
        'clientApprovedAt',
        'clientId',
        'metrics',
      ])
        expect(csSelect).not.toHaveProperty(k);
    });

    it('shows the client name only when verified + permission granted + showOnSite', async () => {
      const row = (
        client: {
          name: string;
          websiteUrl: string | null;
          isVerified: boolean;
          permissionGrantedAt: Date | null;
          showOnSite: boolean;
        } | null,
      ) => ({
        title: 'T',
        summary: 'S',
        caseStudy: {
          slug: 'a',
          coverId: null,
          publishedAt: past,
          sortOrder: 0,
          service: null,
          industry: null,
          product: null,
          client,
        },
      });
      const full = {
        name: 'Acme School',
        websiteUrl: null,
        isVerified: true,
        permissionGrantedAt: past,
        showOnSite: true,
      };
      prisma.caseStudyTranslation.findMany.mockResolvedValue([
        row(full),
        row({ ...full, showOnSite: false }),
        row({ ...full, isVerified: false }),
        row({ ...full, permissionGrantedAt: null }),
        row(null),
      ]);
      const res = await svc.listPublic(base);
      expect(res.data.map((d) => d.clientName)).toEqual(['Acme School', null, null, null, null]);
      expect(JSON.stringify(res)).not.toMatch(/isVerified|permissionGrantedAt|evidence/);
    });

    it('resolves covers with one batched lookup and reads related names from the locale', async () => {
      prisma.caseStudyTranslation.findMany.mockResolvedValue([
        {
          title: 'A',
          summary: 'S',
          caseStudy: {
            slug: 'a',
            coverId: 'm1',
            publishedAt: past,
            sortOrder: 1,
            service: { slug: 'web', translations: [{ name: 'Web' }] },
            industry: { slug: 'edu', translations: [] },
            product: null,
            client: null,
          },
        },
        {
          title: 'B',
          summary: 'S',
          caseStudy: {
            slug: 'b',
            coverId: 'm1',
            publishedAt: past,
            sortOrder: 2,
            service: null,
            industry: null,
            product: null,
            client: null,
          },
        },
      ]);
      prisma.mediaAsset.findMany.mockResolvedValue([
        { id: 'm1', url: 'https://cdn/c.jpg', width: 1, height: 1, alt: { en: 'Cover' } },
      ]);
      const res = await svc.listPublic(base);
      expect(prisma.mediaAsset.findMany).toHaveBeenCalledTimes(1);
      expect(res.data[0]).toMatchObject({
        slug: 'a',
        cover: { url: 'https://cdn/c.jpg', alt: 'Cover' },
        service: { slug: 'web', name: 'Web' },
        industry: { slug: 'edu', name: null },
      });
    });
  });

  describe('public detail', () => {
    it('404 for a missing / not-public project, with the slug in the trust query', async () => {
      prisma.caseStudyTranslation.findFirst.mockResolvedValue(null);
      await expect(svc.getPublicBySlug('nope', 'en')).rejects.toBeInstanceOf(NotFoundException);
      const w = prisma.caseStudyTranslation.findFirst.mock.calls[0][0].where;
      expect(w.caseStudy).toMatchObject({ slug: 'nope', isVerified: true });
      expect(w.status).toBe('PUBLISHED');
    });

    it('returns safe detail: sanitised metrics, no evidence note, hidden client when not disclosed', async () => {
      prisma.caseStudyTranslation.findFirst.mockResolvedValue({
        locale: 'en',
        title: 'T',
        summary: 'S',
        challenge: 'c',
        solution: 's',
        result: 'r',
        body: { a: 1 },
        seoTitle: null,
        seoDescription: null,
        caseStudy: {
          slug: 'a',
          coverId: null,
          publishedAt: past,
          sortOrder: 0,
          service: null,
          industry: null,
          product: null,
          client: {
            name: 'Secret Co',
            websiteUrl: null,
            logoId: null,
            isVerified: true,
            permissionGrantedAt: null,
            showOnSite: true,
          },
          metrics: [{ label: 'Weeks', value: '8' }],
          translations: [{ locale: 'en' }, { locale: 'bn' }],
        },
      });
      const res = await svc.getPublicBySlug('a', 'en');
      expect(res.client).toBeNull();
      expect(res.clientName).toBeNull();
      expect(res.metrics).toEqual([{ label: 'Weeks', value: '8' }]);
      expect(res.availableLocales).toEqual(['bn', 'en']);
      expect(JSON.stringify(res)).not.toMatch(/Secret Co|evidence|isVerified/);
    });

    it('drops malformed metrics stored in the database', async () => {
      prisma.caseStudyTranslation.findFirst.mockResolvedValue({
        locale: 'en',
        title: 'T',
        summary: 'S',
        challenge: null,
        solution: null,
        result: null,
        body: {},
        seoTitle: null,
        seoDescription: null,
        caseStudy: {
          slug: 'a',
          coverId: null,
          publishedAt: past,
          sortOrder: 0,
          service: null,
          industry: null,
          product: null,
          client: null,
          metrics: [{ label: 'x', value: 5 }],
          translations: [],
        },
      });
      expect((await svc.getPublicBySlug('a', 'en')).metrics).toEqual([]);
    });
  });

  describe('admin create', () => {
    const dto = { slug: 'p1', translations: [{ locale: 'en', title: 'T', summary: 'S' }] };
    beforeEach(() => {
      prisma.caseStudy.create.mockResolvedValue({ id: 'id1' });
      prisma.caseStudy.findUnique.mockResolvedValue({
        id: 'id1',
        isVerified: false,
        evidenceNote: null,
        publishedAt: null,
        clientId: null,
        clientApprovedAt: null,
        translations: [],
      });
    });

    it('lets a writer create a plain draft (never verified, never public)', async () => {
      await svc.create(dto, writer);
      const d = prisma.caseStudy.create.mock.calls[0][0].data;
      expect(d).toMatchObject({ isVerified: false, evidenceNote: null, publishedAt: null });
      expect(d.translations.create[0].status).toBe('DRAFT');
    });

    it.each([
      ['isVerified', { isVerified: true, evidenceNote: 'Signed approval email' }],
      ['evidenceNote', { evidenceNote: 'whatever it is' }],
      [
        'clientApprovedAt',
        { clientId: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e', clientApprovedAt: new Date() },
      ],
      ['publishedAt', { publishedAt: new Date() }],
      [
        'publishing a translation',
        { translations: [{ ...dto.translations[0], status: 'PUBLISHED' as const }] },
      ],
    ])('a writer cannot set %s (needs casestudy:publish)', async (_n, over) => {
      await expect(svc.create({ ...dto, ...over } as never, writer)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.caseStudy.create).not.toHaveBeenCalled();
    });

    it('isVerified needs a real evidence note; approval needs a client', async () => {
      await expect(
        svc.create({ ...dto, isVerified: true, evidenceNote: 'short' }, publisher),
      ).rejects.toThrow(/evidenceNote/);
      await expect(svc.create({ ...dto, clientApprovedAt: new Date() }, publisher)).rejects.toThrow(
        /clientId/,
      );
    });

    it('a publisher publishing sets publishedAt automatically', async () => {
      await svc.create(
        { ...dto, translations: [{ ...dto.translations[0], status: 'PUBLISHED' as const }] },
        publisher,
      );
      expect(prisma.caseStudy.create.mock.calls[0][0].data.publishedAt).toBeInstanceOf(Date);
    });

    it('rejects duplicate/unknown locales and an unknown cover', async () => {
      await expect(
        svc.create({ ...dto, translations: [dto.translations[0], dto.translations[0]] }, writer),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        svc.create({ ...dto, translations: [{ locale: 'xx', title: 'a', summary: 'b' }] }, writer),
      ).rejects.toThrow('Unknown or disabled locale');
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      await expect(
        svc.create({ ...dto, coverId: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e' }, writer),
      ).rejects.toThrow('coverId does not match');
    });

    it('maps unique violation to 409 and a bad foreign key to 400', async () => {
      prisma.caseStudy.create.mockRejectedValueOnce({ code: 'P2002' });
      await expect(svc.create(dto, writer)).rejects.toBeInstanceOf(ConflictException);
      prisma.caseStudy.create.mockRejectedValueOnce({ code: 'P2003' });
      await expect(svc.create(dto, writer)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('audit log holds field names only (no evidence text)', async () => {
      await svc.create(
        { ...dto, isVerified: true, evidenceNote: 'CONFIDENTIAL CONTRACT 123' },
        publisher,
      );
      expect(JSON.stringify(prisma.auditLog.create.mock.calls[0][0])).not.toContain('CONFIDENTIAL');
    });
  });

  describe('admin update', () => {
    let cur: Record<string, unknown>;
    beforeEach(() => {
      cur = {
        id: 'id1',
        slug: 'p1',
        isVerified: false,
        evidenceNote: null,
        publishedAt: null,
        clientId: null,
        clientApprovedAt: null,
        translations: [{ locale: 'en', status: 'DRAFT' }],
      };
      prisma.caseStudy.findUnique.mockImplementation(
        async (a: {
          select?: {
            isVerified?: boolean;
            translations?: { select?: { status?: boolean; title?: boolean } };
          };
        }) =>
          a.select?.isVerified &&
          a.select?.translations?.select?.status &&
          !a.select.translations.select.title
            ? cur
            : { ...cur, translations: [] },
      );
    });

    it('404 when missing', async () => {
      prisma.caseStudy.findUnique.mockResolvedValue(null);
      await expect(svc.update('x', {}, writer)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('a writer can edit drafts', async () => {
      await svc.update(
        'id1',
        { translations: [{ locale: 'en', result: 'Delivered on time' }] },
        writer,
      );
      expect(prisma.caseStudyTranslation.update).toHaveBeenCalledWith({
        where: { caseStudyId_locale: { caseStudyId: 'id1', locale: 'en' } },
        data: { result: 'Delivered on time' },
      });
    });

    it('a writer cannot change trust fields, even on a draft', async () => {
      await expect(
        svc.update('id1', { isVerified: true, evidenceNote: 'Signed approval email' }, writer),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('once a translation is PUBLISHED, a writer may only reorder', async () => {
      cur.translations = [{ locale: 'en', status: 'PUBLISHED' }];
      await expect(
        svc.update('id1', { translations: [{ locale: 'en', title: 'New' }] }, writer),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.update('id1', { slug: 'other' }, writer)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(svc.update('id1', { sortOrder: 4 }, writer)).resolves.toBeDefined();
      await expect(
        svc.update('id1', { translations: [{ locale: 'en', title: 'New' }] }, publisher),
      ).resolves.toBeDefined();
    });

    it('first publish stamps publishedAt; an explicit date can schedule', async () => {
      await svc.update('id1', { translations: [{ locale: 'en', status: 'PUBLISHED' }] }, publisher);
      expect(prisma.caseStudy.update.mock.calls[0][0].data.publishedAt).toBeInstanceOf(Date);
      prisma.caseStudy.update.mockClear();
      await svc.update('id1', { publishedAt: future }, publisher);
      expect(prisma.caseStudy.update.mock.calls[0][0].data.publishedAt).toEqual(future);
    });

    it('verification needs evidence (existing or new); un-verifying is allowed', async () => {
      await expect(svc.update('id1', { isVerified: true }, publisher)).rejects.toThrow(
        /evidenceNote/,
      );
      cur.evidenceNote = 'Existing proof of approval';
      await expect(svc.update('id1', { isVerified: true }, publisher)).resolves.toBeDefined();
      cur.isVerified = true;
      await expect(svc.update('id1', { isVerified: false }, publisher)).resolves.toBeDefined();
    });

    it('adding a locale needs title and summary', async () => {
      await expect(
        svc.update('id1', { translations: [{ locale: 'bn', title: 'শিরোনাম' }] }, writer),
      ).rejects.toBeInstanceOf(BadRequestException);
      await svc.update(
        'id1',
        { translations: [{ locale: 'bn', title: 'শিরোনাম', summary: 'সারাংশ' }] },
        writer,
      );
      expect(prisma.caseStudyTranslation.create).toHaveBeenCalled();
    });
  });

  describe('admin read & delete', () => {
    it('detail and list include the visibility report', async () => {
      const row = {
        id: 'id1',
        slug: 'p1',
        isVerified: true,
        evidenceNote: 'Signed approval email',
        publishedAt: past,
        clientId: null,
        clientApprovedAt: null,
        translations: [{ locale: 'en', status: 'PUBLISHED' }],
      };
      prisma.caseStudy.findUnique.mockResolvedValue(row);
      expect((await svc.getAdmin('id1')).visibility).toEqual({
        isPublic: true,
        locales: ['en'],
        blockers: [],
      });
      prisma.caseStudy.findMany.mockResolvedValue([{ ...row, isVerified: false }]);
      const list = await svc.listAdmin({
        page: 1,
        limit: 20,
        sort: 'publishedAt',
        order: 'desc',
        isVerified: false,
        status: 'PUBLISHED',
        serviceId: 's1',
      });
      expect(list.data[0].visibility.blockers).toContain('NOT_VERIFIED');
      expect(prisma.caseStudy.findMany.mock.calls[0][0].orderBy).toEqual([
        { publishedAt: 'desc' },
        { id: 'asc' },
      ]);
    });

    it('delete: 404 / ok / P2025 race', async () => {
      prisma.caseStudy.findUnique.mockResolvedValue(null);
      await expect(svc.remove('x', publisher)).rejects.toBeInstanceOf(NotFoundException);
      prisma.caseStudy.findUnique.mockResolvedValue({ id: 'x', slug: 'p' });
      await svc.remove('x', publisher);
      expect(prisma.caseStudy.delete).toHaveBeenCalledWith({ where: { id: 'x' } });
      prisma.caseStudy.delete.mockRejectedValueOnce({ code: 'P2025' });
      await expect(svc.remove('x', publisher)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
