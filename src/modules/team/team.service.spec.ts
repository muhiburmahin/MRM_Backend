import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { sanitizeSocialLinks, TeamService } from './team.service';

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
const writer = user(['content:read', 'content:write']);
const publisher = user(['content:read', 'content:write', 'content:publish', 'content:delete']);

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
    teamMemberTranslation: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    teamMember: {
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
    post: { count: jest.fn().mockResolvedValue(0) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };
  p.$transaction.mockImplementation(async (fn: (tx: typeof p) => Promise<unknown>) => fn(p));
  return p;
}

describe('sanitizeSocialLinks', () => {
  it('keeps only allow-listed networks with https URLs', () => {
    expect(
      sanitizeSocialLinks({
        linkedin: 'https://linkedin.com/in/x',
        github: 'http://g.com',
        x: 'javascript:alert(1)',
        evil: 'https://e.com',
        website: 'https://a.com',
      }),
    ).toEqual({ linkedin: 'https://linkedin.com/in/x', website: 'https://a.com' });
    expect(sanitizeSocialLinks(null)).toEqual({});
    expect(sanitizeSocialLinks(['https://a.com'])).toEqual({});
  });
});

describe('TeamService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: TeamService;
  beforeEach(() => {
    prisma = makePrisma();
    svc = new TeamService(prisma as never);
  });
  const base = { page: 1, limit: 12, sort: 'sortOrder' as const, order: 'asc' as const };

  describe('public list', () => {
    it('shows only listed members WITH recorded consent, in the locale, and paginates', async () => {
      await svc.listPublic({ ...base, page: 3, limit: 4, locale: 'bn' });
      const a = prisma.teamMemberTranslation.findMany.mock.calls[0][0];
      expect(a.where).toMatchObject({
        locale: 'bn',
        member: { isPublic: true, consentAt: { not: null } },
      });
      expect(a.skip).toBe(8);
      expect(a.take).toBe(4);
    });

    it('uses the default language when none is given', async () => {
      await svc.listPublic(base);
      expect(prisma.teamMemberTranslation.findMany.mock.calls[0][0].where.locale).toBe('en');
    });

    it('filters by department and search, with deterministic ordering', async () => {
      await svc.listPublic({ ...base, department: 'Engineering', q: 'dev', sort: 'name' });
      const a = prisma.teamMemberTranslation.findMany.mock.calls[0][0];
      expect(a.where.member.department).toEqual({ equals: 'Engineering', mode: 'insensitive' });
      expect(a.where.OR).toBeDefined();
      expect(a.orderBy[1]).toEqual({ member: { slug: 'asc' } });
    });

    it('returns only public fields, resolves the photo with ONE batched lookup, and never leaks email/consent/ids', async () => {
      prisma.teamMemberTranslation.count.mockResolvedValue(2);
      prisma.teamMemberTranslation.findMany.mockResolvedValue([
        {
          name: 'Jane',
          roleTitle: 'CTO',
          member: { slug: 'jane', photoId: 'm1', department: 'Eng', sortOrder: 1 },
        },
        {
          name: 'Joe',
          roleTitle: 'Dev',
          member: { slug: 'joe', photoId: 'm1', department: null, sortOrder: 2 },
        },
      ]);
      prisma.mediaAsset.findMany.mockResolvedValue([
        { id: 'm1', url: 'https://cdn/x.jpg', width: 10, height: 10, alt: { en: 'Portrait' } },
      ]);
      const res = await svc.listPublic(base);
      expect(prisma.mediaAsset.findMany).toHaveBeenCalledTimes(1);
      expect(res.data[0]).toEqual({
        slug: 'jane',
        name: 'Jane',
        roleTitle: 'CTO',
        department: 'Eng',
        photo: { url: 'https://cdn/x.jpg', width: 10, height: 10, alt: 'Portrait' },
        sortOrder: 1,
      });
      expect(JSON.stringify(res)).not.toMatch(/email|consent|photoId|isPublic/);
      expect(res.meta).toEqual({ page: 1, limit: 12, total: 2, totalPages: 1 });
    });

    it('photo is null when the media asset is missing', async () => {
      prisma.teamMemberTranslation.findMany.mockResolvedValue([
        {
          name: 'Jane',
          roleTitle: 'CTO',
          member: { slug: 'jane', photoId: 'gone', department: null, sortOrder: 0 },
        },
      ]);
      expect((await svc.listPublic(base)).data[0].photo).toBeNull();
    });
  });

  describe('public detail', () => {
    const row = (over: Record<string, unknown> = {}) => ({
      locale: 'en',
      name: 'Jane',
      roleTitle: 'CTO',
      bio: 'Bio',
      member: {
        slug: 'jane',
        photoId: null,
        department: null,
        sortOrder: 0,
        email: 'jane@x.com',
        showEmail: false,
        socialLinks: { linkedin: 'https://l.com/j', x: 'javascript:1' },
        translations: [{ locale: 'en' }, { locale: 'bn' }],
        ...over,
      },
    });

    it('404 for a missing / non-public member', async () => {
      prisma.teamMemberTranslation.findFirst.mockResolvedValue(null);
      await expect(svc.getPublicBySlug('x', 'en')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.teamMemberTranslation.findFirst.mock.calls[0][0].where.member).toMatchObject({
        isPublic: true,
        consentAt: { not: null },
        slug: 'x',
      });
    });

    it('hides the email unless the member opted in, and sanitises social links', async () => {
      prisma.teamMemberTranslation.findFirst.mockResolvedValue(row());
      let res = await svc.getPublicBySlug('jane', 'en');
      expect(res.email).toBeNull();
      expect(res.socialLinks).toEqual({ linkedin: 'https://l.com/j' });
      expect(res.availableLocales).toEqual(['bn', 'en']);

      prisma.teamMemberTranslation.findFirst.mockResolvedValue(row({ showEmail: true }));
      res = await svc.getPublicBySlug('jane', 'en');
      expect(res.email).toBe('jane@x.com');
    });
  });

  describe('admin create', () => {
    const dto = { slug: 'jane', translations: [{ locale: 'en', name: 'Jane', roleTitle: 'CTO' }] };
    beforeEach(() => {
      prisma.teamMember.create.mockResolvedValue({ id: 'id1' });
      prisma.teamMember.findUnique.mockResolvedValue({ id: 'id1' });
    });

    it('rejects duplicate/unknown locales, showEmail without email, and unknown photo', async () => {
      await expect(
        svc.create({ ...dto, translations: [dto.translations[0], dto.translations[0]] }, writer),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        svc.create({ ...dto, translations: [{ locale: 'xx', name: 'a', roleTitle: 'b' }] }, writer),
      ).rejects.toThrow('Unknown or disabled locale');
      await expect(svc.create({ ...dto, showEmail: true }, writer)).rejects.toThrow(
        'showEmail requires an email',
      );
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      await expect(
        svc.create({ ...dto, photoId: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e' }, writer),
      ).rejects.toThrow('photoId does not match');
    });

    it('creates a private profile by default, lowercases email', async () => {
      await svc.create({ ...dto, email: 'Jane@X.com' }, writer);
      const data = prisma.teamMember.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ isPublic: false, consentAt: null, email: 'jane@x.com' });
    });

    it('refuses to make a profile public without consent', async () => {
      await expect(svc.create({ ...dto, isPublic: true }, publisher)).rejects.toThrow(/consent/i);
    });

    it('needs the publish permission to go public, then records consent', async () => {
      await expect(
        svc.create({ ...dto, isPublic: true, consentGiven: true }, writer),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await svc.create({ ...dto, isPublic: true, consentGiven: true }, publisher);
      const data = prisma.teamMember.create.mock.calls[0][0].data;
      expect(data.isPublic).toBe(true);
      expect(data.consentAt).toBeInstanceOf(Date);
    });

    it('maps a unique violation to 409 and audits without personal data', async () => {
      prisma.teamMember.create.mockRejectedValue({ code: 'P2002' });
      await expect(svc.create(dto, writer)).rejects.toBeInstanceOf(ConflictException);
      prisma.teamMember.create.mockResolvedValue({ id: 'id1' });
      await svc.create({ ...dto, email: 'jane@x.com' }, writer);
      expect(JSON.stringify(prisma.auditLog.create.mock.calls[0][0])).not.toContain('jane@x.com');
    });
  });

  describe('admin update', () => {
    let cur: Record<string, unknown>;
    beforeEach(() => {
      cur = {
        id: 'id1',
        slug: 'jane',
        email: null,
        showEmail: false,
        isPublic: false,
        consentAt: null,
        translations: [{ locale: 'en' }],
      };
      prisma.teamMember.findUnique.mockImplementation(
        async (a: {
          select?: { translations?: { select?: { locale?: boolean } }; isPublic?: boolean };
        }) => (a.select?.translations?.select?.locale && a.select.isPublic ? cur : { id: 'id1' }),
      );
    });

    it('404 when missing', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(null);
      await expect(svc.update('x', {}, writer)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets a writer edit a non-public profile', async () => {
      await svc.update(
        'id1',
        { department: 'Eng', translations: [{ locale: 'en', bio: 'New bio' }] },
        writer,
      );
      expect(prisma.teamMemberTranslation.update).toHaveBeenCalledWith({
        where: { memberId_locale: { memberId: 'id1', locale: 'en' } },
        data: { bio: 'New bio' },
      });
    });

    it('blocks a writer from changing a PUBLIC profile, but allows harmless fields', async () => {
      cur.isPublic = true;
      cur.consentAt = new Date();
      await expect(svc.update('id1', { department: 'X' }, writer)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        svc.update('id1', { translations: [{ locale: 'en', name: 'N' }] }, writer),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.update('id1', { sortOrder: 5 }, writer)).resolves.toBeDefined();
      await expect(svc.update('id1', { department: 'X' }, publisher)).resolves.toBeDefined();
    });

    it('requires name and roleTitle when adding a locale', async () => {
      await expect(
        svc.update('id1', { translations: [{ locale: 'bn', name: 'নাম' }] }, writer),
      ).rejects.toBeInstanceOf(BadRequestException);
      await svc.update(
        'id1',
        { translations: [{ locale: 'bn', name: 'নাম', roleTitle: 'পদবি' }] },
        writer,
      );
      expect(prisma.teamMemberTranslation.create).toHaveBeenCalled();
    });

    it('publishing needs consent; consentGiven:true records it', async () => {
      await expect(svc.update('id1', { isPublic: true }, publisher)).rejects.toThrow(/consent/i);
      await svc.update('id1', { isPublic: true, consentGiven: true }, publisher);
      const data = prisma.teamMember.update.mock.calls[0][0].data;
      expect(data.isPublic).toBe(true);
      expect(data.consentAt).toBeInstanceOf(Date);
    });

    it('withdrawing consent unpublishes and clears the consent record', async () => {
      cur.isPublic = true;
      cur.consentAt = new Date();
      await svc.update('id1', { consentGiven: false }, publisher);
      expect(prisma.teamMember.update.mock.calls[0][0].data).toMatchObject({
        isPublic: false,
        consentAt: null,
      });
      await expect(
        svc.update('id1', { consentGiven: false, isPublic: true }, publisher),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('clearing the email while showEmail stays on is rejected', async () => {
      cur.email = 'a@b.com';
      cur.showEmail = true;
      await expect(svc.update('id1', { email: null }, writer)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('admin delete', () => {
    it('404 / 409 when the member authored posts / ok otherwise', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(null);
      await expect(svc.remove('x', publisher)).rejects.toBeInstanceOf(NotFoundException);
      prisma.teamMember.findUnique.mockResolvedValue({ id: 'x', slug: 'jane' });
      prisma.post.count.mockResolvedValue(3);
      await expect(svc.remove('x', publisher)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.teamMember.delete).not.toHaveBeenCalled();
      prisma.post.count.mockResolvedValue(0);
      await svc.remove('x', publisher);
      expect(prisma.teamMember.delete).toHaveBeenCalledWith({ where: { id: 'x' } });
    });
  });

  describe('admin list', () => {
    it('applies filters and a stable sort', async () => {
      await svc.listAdmin({
        page: 1,
        limit: 20,
        sort: 'joinedAt',
        order: 'desc',
        q: 'ja',
        isPublic: false,
        department: 'Eng',
      });
      const a = prisma.teamMember.findMany.mock.calls[0][0];
      expect(a.where).toMatchObject({
        isPublic: false,
        department: { equals: 'Eng', mode: 'insensitive' },
      });
      expect(a.orderBy).toEqual([{ joinedAt: 'desc' }, { id: 'asc' }]);
    });
  });
});
