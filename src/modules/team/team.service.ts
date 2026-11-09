import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { AdminQueryTeamDto, QueryTeamDto } from './dto/query-team.dto';
import { CreateTeamMemberDto, UpdateTeamMemberDto } from './dto/team-write.dto';
import { isHttpsUrl } from './dto/validators';
import { SOCIAL_KEYS, SortOrder, TEAM_PERMISSIONS } from './team.constants';

const FALLBACK_LOCALE = 'en';

/** Version-agnostic Prisma error code (works with any Prisma major). */
const prismaCode = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined;

/** Prisma `Json` input type differs between versions; this single cast keeps the rest strictly typed. */
const asJson = (v: Record<string, unknown>): never => v as never;

const meta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

/** Defence in depth: only allow-listed networks with https URLs ever leave the API. */
export function sanitizeSocialLinks(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out;
  for (const key of SOCIAL_KEYS) {
    const v = (value as Record<string, unknown>)[key];
    if (isHttpsUrl(v)) out[key] = v;
  }
  return out;
}

const altFor = (alt: unknown, locale: string, fallback: string): string => {
  if (typeof alt === 'object' && alt !== null) {
    const v = (alt as Record<string, unknown>)[locale];
    if (typeof v === 'string' && v) return v;
  }
  return fallback;
};

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Public ─────────────────────────

  async listPublic(query: QueryTeamDto) {
    const locale = await this.resolveLocale(query.locale);
    const where: any = {
      isActive: true,
      isPublic: true,
      ...(query.department
        ? { department: { equals: query.department, mode: 'insensitive' as const } }
        : {}),
    };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' as const } },
        { role: { contains: query.q, mode: 'insensitive' as const } },
        {
          translations: {
            some: {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' as const } },
                { roleTitle: { contains: query.q, mode: 'insensitive' as const } },
              ],
            },
          },
        },
      ];
    }

    const dir: SortOrder = query.order || 'asc';
    const orderBy =
      query.sort === 'name'
        ? [{ name: dir }, { order: 'asc' as const }]
        : [{ order: dir }, { sortOrder: dir }, { createdAt: 'desc' as const }];

    const [total, rows] = await Promise.all([
      this.prisma.teamMember.count({ where }),
      this.prisma.teamMember.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          slug: true,
          name: true,
          role: true,
          photo: true,
          bio: true,
          email: true,
          showEmail: true,
          linkedinUrl: true,
          githubUrl: true,
          order: true,
          sortOrder: true,
          department: true,
          photoId: true,
          translations: {
            where: { locale },
            select: { name: true, roleTitle: true, bio: true },
          },
        },
      }),
    ]);

    const photos = await this.photoMap(rows.map((r) => r.photoId));

    return {
      data: rows.map((r) => {
        const trans = r.translations?.[0];
        const displayName = trans?.name || r.name || r.slug;
        const displayRole = trans?.roleTitle || r.role || 'Team Member';
        const displayBio = trans?.bio || r.bio;
        const mediaPhoto = this.photoOf(r.photoId, photos, locale, displayName);
        const resolvedPhoto = r.photo || mediaPhoto?.url || null;

        return {
          id: r.id,
          slug: r.slug,
          name: displayName,
          role: displayRole,
          roleTitle: displayRole,
          photo: resolvedPhoto,
          photoUrl: resolvedPhoto,
          bio: displayBio,
          email: r.showEmail ? r.email : null,
          linkedinUrl: r.linkedinUrl,
          githubUrl: r.githubUrl,
          order: r.order ?? r.sortOrder ?? 0,
          sortOrder: r.sortOrder ?? r.order ?? 0,
          department: r.department,
        };
      }),
      meta: meta(query.page, query.limit, total),
    };
  }

  async getPublicBySlug(slug: string, localeParam?: string) {
    const locale = await this.resolveLocale(localeParam);
    const row = await this.prisma.teamMemberTranslation.findFirst({
      where: { ...this.publicWhere(locale), member: { ...this.publicMember(), slug } },
      select: {
        locale: true,
        name: true,
        roleTitle: true,
        bio: true,
        member: {
          select: {
            slug: true,
            photoId: true,
            department: true,
            sortOrder: true,
            socialLinks: true,
            email: true,
            showEmail: true,
            translations: { select: { locale: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Team member not found');
    const photos = await this.photoMap([row.member.photoId]);
    return {
      slug: row.member.slug,
      locale: row.locale,
      name: row.name,
      roleTitle: row.roleTitle,
      bio: row.bio,
      department: row.member.department,
      sortOrder: row.member.sortOrder,
      photo: this.photoOf(row.member.photoId, photos, locale, row.name),
      socialLinks: sanitizeSocialLinks(row.member.socialLinks),
      email: row.member.showEmail ? row.member.email : null,
      availableLocales: row.member.translations.map((t) => t.locale).sort(),
    };
  }

  // ───────────────────────── Admin ─────────────────────────

  async listAdmin(query: AdminQueryTeamDto) {
    const search = query.q
      ? [
          { slug: { contains: query.q, mode: 'insensitive' as const } },
          { name: { contains: query.q, mode: 'insensitive' as const } },
          { role: { contains: query.q, mode: 'insensitive' as const } },
          { email: { contains: query.q, mode: 'insensitive' as const } },
          {
            translations: {
              some: {
                OR: [
                  { name: { contains: query.q, mode: 'insensitive' as const } },
                  { roleTitle: { contains: query.q, mode: 'insensitive' as const } },
                ],
              },
            },
          },
        ]
      : undefined;
    const where = {
      ...(query.isPublic !== undefined ? { isPublic: query.isPublic } : {}),
      ...(query.department
        ? { department: { equals: query.department, mode: 'insensitive' as const } }
        : {}),
      ...(search ? { OR: search } : {}),
    };
    const dir: SortOrder = query.order;
    const orderByMap: Record<string, unknown> = {
      order: { order: dir },
      sortOrder: { sortOrder: dir },
      slug: { slug: dir },
      joinedAt: { joinedAt: dir },
      createdAt: { createdAt: dir },
      updatedAt: { updatedAt: dir },
    };
    const orderBy = orderByMap[query.sort] || { order: dir };

    const [total, rows] = await Promise.all([
      this.prisma.teamMember.count({ where }),
      this.prisma.teamMember.findMany({
        where,
        orderBy: [orderBy as never, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: this.adminSelect,
      }),
    ]);
    return { data: rows, meta: meta(query.page, query.limit, total) };
  }

  async getAdmin(id: string) {
    const row = await this.prisma.teamMember.findUnique({
      where: { id },
      select: this.adminSelect,
    });
    if (!row) throw new NotFoundException('Team member not found');
    return row;
  }

  async create(dto: CreateTeamMemberDto, actor: AuthenticatedUser) {
    const order = dto.order ?? dto.sortOrder ?? 0;
    dto.order = order;
    dto.sortOrder = order;

    if (!dto.translations || dto.translations.length === 0) {
      const memberName = dto.name || 'Team Member';
      const memberRole = dto.role || 'Member';
      const memberBio = dto.bio || null;
      dto.translations = [
        {
          locale: 'en',
          name: memberName,
          roleTitle: memberRole,
          bio: memberBio,
        },
      ];
    }

    const primaryName = dto.name || dto.translations[0]?.name || 'Team Member';
    const primaryRole = dto.role || dto.translations[0]?.roleTitle || 'Member';
    const primaryBio = dto.bio || dto.translations[0]?.bio || null;

    let slug = dto.slug;
    if (!slug) {
      slug = primaryName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!slug) slug = `member-${Date.now()}`;
    }

    const locales = dto.translations.map((t) => t.locale);
    this.assertUnique(locales);
    await this.assertLocalesEnabled(locales);
    await this.assertPhotoExists(dto.photoId);
    this.assertEmailRule(dto.email ?? null, dto.showEmail ?? false);

    if (dto.consentGiven === undefined && dto.isPublic !== false) {
      dto.consentGiven = true;
    }
    const consent = this.resolveConsent(null, dto);
    if (consent.isPublic) this.requirePublish(actor);

    try {
      const created = await this.prisma.teamMember.create({
        data: {
          slug,
          name: primaryName,
          role: primaryRole,
          photo: dto.photo ?? null,
          bio: primaryBio,
          email: dto.email ? dto.email.toLowerCase() : null,
          showEmail: dto.showEmail ?? false,
          linkedinUrl: dto.linkedinUrl ?? null,
          githubUrl: dto.githubUrl ?? null,
          order,
          sortOrder: order,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
          photoId: dto.photoId ?? null,
          department: dto.department ?? null,
          socialLinks: asJson(
            dto.socialLinks ?? {
              linkedin: dto.linkedinUrl || '',
              github: dto.githubUrl || '',
            },
          ),
          joinedAt: dto.joinedAt ?? null,
          isPublic: consent.isPublic ?? true,
          consentAt: consent.consentAt ?? new Date(),
          translations: {
            create: dto.translations.map((t) => ({
              locale: t.locale,
              name: t.name,
              roleTitle: t.roleTitle,
              bio: t.bio ?? null,
            })),
          },
        },
        select: { id: true },
      });
      await this.audit(actor, 'team.create', created.id, {
        slug,
        locales,
        isPublic: consent.isPublic ?? true,
      });
      return this.getAdmin(created.id);
    } catch (err) {
      this.rethrow(err);
    }
  }

  async update(id: string, dto: UpdateTeamMemberDto, actor: AuthenticatedUser) {
    const cur = await this.prisma.teamMember.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        email: true,
        showEmail: true,
        isPublic: true,
        consentAt: true,
        translations: { select: { locale: true } },
      },
    });
    if (!cur) throw new NotFoundException('Team member not found');

    if (dto.order !== undefined && dto.sortOrder === undefined) {
      dto.sortOrder = dto.order;
    } else if (dto.sortOrder !== undefined && dto.order === undefined) {
      dto.order = dto.sortOrder;
    }

    const incoming = dto.translations ?? [];
    const locales = incoming.map((t) => t.locale);
    this.assertUnique(locales);
    await this.assertLocalesEnabled(locales);
    await this.assertPhotoExists(dto.photoId);

    const existingLocales = new Set(cur.translations.map((t) => t.locale));
    for (const t of incoming) {
      if (!existingLocales.has(t.locale) && (!t.name || !t.roleTitle)) {
        throw new BadRequestException(
          `"name" and "roleTitle" are required to add the "${t.locale}" translation`,
        );
      }
    }
    this.assertEmailRule(
      dto.email !== undefined ? dto.email : cur.email,
      dto.showEmail ?? cur.showEmail,
    );

    if (dto.consentGiven === undefined && dto.isPublic === true && !cur.consentAt) {
      dto.consentGiven = true;
    }
    const consent = this.resolveConsent(cur, dto);

    // Publishing, or changing anything visible about an already-public profile, needs the publish permission.
    const visibleChange =
      incoming.length > 0 ||
      (dto.slug !== undefined && dto.slug !== cur.slug) ||
      (
        [
          'name',
          'role',
          'photo',
          'bio',
          'linkedinUrl',
          'githubUrl',
          'order',
          'isActive',
          'department',
          'email',
          'showEmail',
          'photoId',
          'socialLinks',
          'isPublic',
          'consentGiven',
        ] as const
      ).some((k) => dto[k] !== undefined);
    if ((cur.isPublic && visibleChange) || consent.isPublic === true) this.requirePublish(actor);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.teamMember.update({
          where: { id },
          data: {
            ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.role !== undefined ? { role: dto.role } : {}),
            ...(dto.photo !== undefined ? { photo: dto.photo ?? null } : {}),
            ...(dto.bio !== undefined ? { bio: dto.bio ?? null } : {}),
            ...(dto.linkedinUrl !== undefined ? { linkedinUrl: dto.linkedinUrl ?? null } : {}),
            ...(dto.githubUrl !== undefined ? { githubUrl: dto.githubUrl ?? null } : {}),
            ...(dto.order !== undefined ? { order: dto.order } : {}),
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            ...(dto.department !== undefined ? { department: dto.department ?? null } : {}),
            ...(dto.email !== undefined
              ? { email: dto.email ? dto.email.toLowerCase() : null }
              : {}),
            ...(dto.showEmail !== undefined ? { showEmail: dto.showEmail } : {}),
            ...(dto.photoId !== undefined ? { photoId: dto.photoId ?? null } : {}),
            ...(dto.socialLinks !== undefined ? { socialLinks: asJson(dto.socialLinks) } : {}),
            ...(dto.joinedAt !== undefined ? { joinedAt: dto.joinedAt } : {}),
            ...(consent.isPublic !== undefined ? { isPublic: consent.isPublic } : {}),
            ...(consent.consentAt !== undefined ? { consentAt: consent.consentAt } : {}),
          },
        });

        // Sync with primary translations if direct fields are provided and translations omitted
        if (
          incoming.length === 0 &&
          (dto.name !== undefined || dto.role !== undefined || dto.bio !== undefined)
        ) {
          const transData: Record<string, string | null> = {};
          if (dto.name !== undefined) transData.name = dto.name;
          if (dto.role !== undefined) transData.roleTitle = dto.role;
          if (dto.bio !== undefined) transData.bio = dto.bio ?? null;

          if (existingLocales.has('en')) {
            await tx.teamMemberTranslation.update({
              where: { memberId_locale: { memberId: id, locale: 'en' } },
              data: transData,
            });
          } else if (existingLocales.size > 0) {
            const firstLocale = cur.translations[0]?.locale;
            if (firstLocale) {
              await tx.teamMemberTranslation.update({
                where: { memberId_locale: { memberId: id, locale: firstLocale } },
                data: transData,
              });
            }
          }
        }

        for (const t of incoming) {
          const data = {
            ...(t.name !== undefined ? { name: t.name } : {}),
            ...(t.roleTitle !== undefined ? { roleTitle: t.roleTitle } : {}),
            ...(t.bio !== undefined ? { bio: t.bio } : {}),
          };
          if (existingLocales.has(t.locale)) {
            await tx.teamMemberTranslation.update({
              where: { memberId_locale: { memberId: id, locale: t.locale } },
              data,
            });
          } else {
            await tx.teamMemberTranslation.create({
              data: {
                memberId: id,
                locale: t.locale,
                name: t.name as string,
                roleTitle: t.roleTitle as string,
                bio: t.bio ?? null,
              },
            });
          }
        }
      });
    } catch (err) {
      this.rethrow(err);
    }
    // Field NAMES only: never write names, emails or bios into the audit log.
    await this.audit(actor, 'team.update', id, {
      fields: Object.keys(dto).filter((k) => k !== 'translations'),
      locales,
    });
    return this.getAdmin(id);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const found = await this.prisma.teamMember.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!found) throw new NotFoundException('Team member not found');

    // Post.author is optional: the schema would silently SET NULL and orphan the articles' author.
    const posts = await this.prisma.post.count({ where: { authorId: id } });
    if (posts > 0) {
      throw new ConflictException(
        'This member is the author of blog posts. Unpublish the profile (isPublic: false) instead of deleting it.',
      );
    }
    try {
      await this.prisma.teamMember.delete({ where: { id } }); // translations cascade
    } catch (err) {
      this.rethrow(err);
    }
    await this.audit(actor, 'team.delete', id, { slug: found.slug });
  }

  // ───────────────────────── helpers ─────────────────────────

  private readonly adminSelect = {
    id: true,
    slug: true,
    name: true,
    role: true,
    photo: true,
    bio: true,
    email: true,
    showEmail: true,
    linkedinUrl: true,
    githubUrl: true,
    order: true,
    sortOrder: true,
    isActive: true,
    photoId: true,
    department: true,
    socialLinks: true,
    isPublic: true,
    consentAt: true,
    joinedAt: true,
    createdAt: true,
    updatedAt: true,
    translations: {
      select: { locale: true, name: true, roleTitle: true, bio: true },
      orderBy: { locale: 'asc' as const },
    },
  };

  /** Single definition of "publicly visible member": listed AND consent recorded. */
  private publicMember() {
    return { isPublic: true, consentAt: { not: null } };
  }

  private publicWhere(locale: string, q?: string, department?: string) {
    return {
      locale,
      member: {
        ...this.publicMember(),
        ...(department ? { department: { equals: department, mode: 'insensitive' as const } } : {}),
      },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { roleTitle: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  private async resolveLocale(locale?: string): Promise<string> {
    if (locale) return locale;
    const def = await this.prisma.language.findFirst({
      where: { isDefault: true, isEnabled: true },
      select: { code: true },
    });
    return def?.code ?? FALLBACK_LOCALE;
  }

  /** photoId is an intentional plain UUID (no FK), so resolve it with ONE batched lookup. */
  private async photoMap(ids: Array<string | null>) {
    const unique = [...new Set(ids.filter((i): i is string => !!i))];
    if (!unique.length)
      return new Map<
        string,
        { url: string; width: number | null; height: number | null; alt: unknown }
      >();
    const rows = await this.prisma.mediaAsset.findMany({
      where: { id: { in: unique } },
      select: { id: true, url: true, width: true, height: true, alt: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }

  private photoOf(
    photoId: string | null,
    photos: Awaited<ReturnType<TeamService['photoMap']>>,
    locale: string,
    name: string,
  ) {
    const p = photoId ? photos.get(photoId) : undefined;
    return p
      ? { url: p.url, width: p.width, height: p.height, alt: altFor(p.alt, locale, name) }
      : null;
  }

  private async assertPhotoExists(photoId?: string | null): Promise<void> {
    if (!photoId) return;
    const found = await this.prisma.mediaAsset.findUnique({
      where: { id: photoId },
      select: { id: true },
    });
    if (!found) throw new BadRequestException('photoId does not match an existing media asset');
  }

  private assertEmailRule(email: string | null, showEmail: boolean): void {
    if (showEmail && !email) throw new BadRequestException('showEmail requires an email address');
  }

  /**
   * Consent rules: a profile can be public only with recorded consent.
   * consentGiven:true records consent (timestamp), consentGiven:false withdraws it and unpublishes.
   */
  private resolveConsent(
    cur: { isPublic: boolean; consentAt: Date | null } | null,
    dto: { isPublic?: boolean; consentGiven?: boolean },
  ) {
    const out: { isPublic?: boolean; consentAt?: Date | null } = {};
    if (dto.consentGiven === false) {
      if (dto.isPublic === true)
        throw new BadRequestException('Cannot publish a profile while withdrawing consent');
      out.consentAt = null;
      out.isPublic = false;
      return out;
    }
    if (dto.consentGiven === true && !cur?.consentAt) out.consentAt = new Date();
    if (dto.isPublic !== undefined) out.isPublic = dto.isPublic;

    const finalPublic = out.isPublic ?? cur?.isPublic ?? false;
    const finalConsent = out.consentAt !== undefined ? out.consentAt : (cur?.consentAt ?? null);
    if (finalPublic && !finalConsent) {
      throw new BadRequestException(
        "The member's consent is required before the profile can be public (send consentGiven: true)",
      );
    }
    return out;
  }

  private assertUnique(locales: string[]): void {
    if (new Set(locales).size !== locales.length)
      throw new BadRequestException('Each locale may appear only once');
  }

  private async assertLocalesEnabled(locales: string[]): Promise<void> {
    if (!locales.length) return;
    const rows = await this.prisma.language.findMany({
      where: { code: { in: locales }, isEnabled: true },
      select: { code: true },
    });
    const ok = new Set(rows.map((r) => r.code));
    const bad = locales.filter((l) => !ok.has(l));
    if (bad.length) throw new BadRequestException(`Unknown or disabled locale: ${bad.join(', ')}`);
  }

  private requirePublish(actor: AuthenticatedUser): void {
    if (!actor.permissions.includes(TEAM_PERMISSIONS.publish)) {
      throw new ForbiddenException(
        'Publishing or changing a public profile requires the publish permission',
      );
    }
  }

  private rethrow(err: unknown): never {
    switch (prismaCode(err)) {
      case 'P2002':
        throw new ConflictException('A team member with this slug (or locale) already exists');
      case 'P2025':
        throw new NotFoundException('Team member not found');
      case 'P2003':
        throw new ConflictException('The team member is still referenced by other records');
      default:
        throw err;
    }
  }

  private async audit(
    actor: AuthenticatedUser,
    action: string,
    entityId: string,
    diff: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action,
          entityType: 'team_member',
          entityId,
          diff: diff as never,
        },
      });
    } catch (err) {
      this.logger.error(`Audit log write failed for ${action}: ${(err as Error).message}`);
    }
  }
}
