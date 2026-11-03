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
    const where = this.publicWhere(locale, query.q, query.department);
    const tie = { member: { slug: 'asc' as const } };
    const orderBy =
      query.sort === 'name'
        ? [{ name: query.order }, tie]
        : [{ member: { sortOrder: query.order } }, tie];

    const [total, rows] = await Promise.all([
      this.prisma.teamMemberTranslation.count({ where }),
      this.prisma.teamMemberTranslation.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          name: true,
          roleTitle: true,
          member: { select: { slug: true, photoId: true, department: true, sortOrder: true } },
        },
      }),
    ]);
    const photos = await this.photoMap(rows.map((r) => r.member.photoId));
    return {
      data: rows.map((r) => ({
        slug: r.member.slug,
        name: r.name,
        roleTitle: r.roleTitle,
        department: r.member.department,
        photo: this.photoOf(r.member.photoId, photos, locale, r.name),
        sortOrder: r.member.sortOrder,
      })),
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
    const orderBy = {
      sortOrder: { sortOrder: dir },
      slug: { slug: dir },
      joinedAt: { joinedAt: dir },
    }[query.sort];

    const [total, rows] = await Promise.all([
      this.prisma.teamMember.count({ where }),
      this.prisma.teamMember.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
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
    const locales = dto.translations.map((t) => t.locale);
    this.assertUnique(locales);
    await this.assertLocalesEnabled(locales);
    await this.assertPhotoExists(dto.photoId);
    this.assertEmailRule(dto.email ?? null, dto.showEmail ?? false);
    const consent = this.resolveConsent(null, dto);
    if (consent.isPublic) this.requirePublish(actor);

    try {
      const created = await this.prisma.teamMember.create({
        data: {
          slug: dto.slug,
          department: dto.department ?? null,
          email: dto.email ? dto.email.toLowerCase() : null,
          showEmail: dto.showEmail ?? false,
          photoId: dto.photoId ?? null,
          socialLinks: asJson(dto.socialLinks ?? {}),
          joinedAt: dto.joinedAt ?? null,
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          isPublic: consent.isPublic ?? false,
          consentAt: consent.consentAt ?? null,
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
        slug: dto.slug,
        locales,
        isPublic: consent.isPublic ?? false,
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
    const consent = this.resolveConsent(cur, dto);

    // Publishing, or changing anything visible about an already-public profile, needs the publish permission.
    const visibleChange =
      incoming.length > 0 ||
      (dto.slug !== undefined && dto.slug !== cur.slug) ||
      (
        [
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
            ...(dto.department !== undefined ? { department: dto.department } : {}),
            ...(dto.email !== undefined
              ? { email: dto.email ? dto.email.toLowerCase() : null }
              : {}),
            ...(dto.showEmail !== undefined ? { showEmail: dto.showEmail } : {}),
            ...(dto.photoId !== undefined ? { photoId: dto.photoId } : {}),
            ...(dto.socialLinks !== undefined ? { socialLinks: asJson(dto.socialLinks) } : {}),
            ...(dto.joinedAt !== undefined ? { joinedAt: dto.joinedAt } : {}),
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
            ...(consent.isPublic !== undefined ? { isPublic: consent.isPublic } : {}),
            ...(consent.consentAt !== undefined ? { consentAt: consent.consentAt } : {}),
          },
        });
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
    photoId: true,
    department: true,
    email: true,
    showEmail: true,
    socialLinks: true,
    isPublic: true,
    consentAt: true,
    sortOrder: true,
    joinedAt: true,
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
