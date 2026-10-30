import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AdminQueryServicesDto, QueryServicesDto } from './dto/query-services.dto';
import { CreateServiceDto } from './dto/service-write.dto';
import { UpdateServiceDto } from './dto/service-write.dto';
import { SERVICE_PERMISSIONS, SortOrder } from './services.constants';

const PUBLISHED = 'PUBLISHED' as const;
const FALLBACK_LOCALE = 'en';

/** Version-agnostic Prisma error code (avoids importing the generated runtime classes). */
const prismaCode = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : undefined;

/** Prisma `Json` input type differs between versions; this single cast keeps the rest strictly typed. */
const asJson = (v: Record<string, unknown>): never => v as never;

const meta = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Public ─────────────────────────

  async listPublic(query: QueryServicesDto) {
    const locale = await this.resolveLocale(query.locale);
    const where = this.publicWhere(locale, query.q);
    const [total, rows] = await Promise.all([
      this.prisma.serviceTranslation.count({ where }),
      this.prisma.serviceTranslation.findMany({
        where,
        orderBy: this.publicOrderBy(query.sort, query.order),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          name: true, summary: true, publishedAt: true,
          service: { select: { slug: true, icon: true, sortOrder: true } },
        },
      }),
    ]);
    return {
      data: rows.map((r) => ({
        slug: r.service.slug, icon: r.service.icon, sortOrder: r.service.sortOrder,
        name: r.name, summary: r.summary, publishedAt: r.publishedAt,
      })),
      meta: meta(query.page, query.limit, total),
    };
  }

  async getPublicBySlug(slug: string, localeParam?: string) {
    const locale = await this.resolveLocale(localeParam);
    const row = await this.prisma.serviceTranslation.findFirst({
      where: { ...this.publicWhere(locale), service: { isActive: true, slug } },
      select: {
        locale: true, name: true, summary: true, body: true, publishedAt: true, seoTitle: true, seoDescription: true,
        service: {
          select: {
            slug: true, icon: true, sortOrder: true,
            translations: { where: { status: PUBLISHED }, select: { locale: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Service not found');
    return {
      slug: row.service.slug, icon: row.service.icon, sortOrder: row.service.sortOrder,
      locale: row.locale, name: row.name, summary: row.summary, body: row.body, publishedAt: row.publishedAt,
      seoTitle: row.seoTitle, seoDescription: row.seoDescription,
      availableLocales: row.service.translations.map((t) => t.locale).sort(),
    };
  }

  // ───────────────────────── Admin ─────────────────────────

  async listAdmin(query: AdminQueryServicesDto) {
    const search = query.q
      ? [{ slug: { contains: query.q, mode: 'insensitive' as const } },
         { translations: { some: { name: { contains: query.q, mode: 'insensitive' as const } } } }]
      : undefined;
    const where = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.status ? { translations: { some: { status: query.status } } } : {}),
      ...(search ? { OR: search } : {}),
    };
    const dir: SortOrder = query.order;
    const orderBy = {
      sortOrder: { sortOrder: dir }, slug: { slug: dir }, createdAt: { createdAt: dir }, updatedAt: { updatedAt: dir },
    }[query.sort];

    const [total, rows] = await Promise.all([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true, slug: true, icon: true, sortOrder: true, isActive: true, createdAt: true, updatedAt: true,
          translations: { select: { locale: true, name: true, status: true, publishedAt: true }, orderBy: { locale: 'asc' } },
        },
      }),
    ]);
    return { data: rows, meta: meta(query.page, query.limit, total) };
  }

  async getAdmin(id: string) {
    const row = await this.prisma.service.findUnique({
      where: { id },
      select: {
        id: true, slug: true, icon: true, sortOrder: true, isActive: true, createdAt: true, updatedAt: true,
        translations: {
          select: { locale: true, name: true, summary: true, body: true, status: true, publishedAt: true, seoTitle: true, seoDescription: true },
          orderBy: { locale: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Service not found');
    return row;
  }

  async create(dto: CreateServiceDto, actor: AuthenticatedUser) {
    const locales = dto.translations.map((t) => t.locale);
    this.assertUnique(locales);
    await this.assertLocalesEnabled(locales);
    if (dto.translations.some((t) => t.status === PUBLISHED)) this.requirePublish(actor);

    try {
      const created = await this.prisma.service.create({
        data: {
          slug: dto.slug,
          icon: dto.icon ?? null,
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          translations: {
            create: dto.translations.map((t) => ({
              locale: t.locale, name: t.name, summary: t.summary, body: asJson(t.body ?? {}),
              status: t.status ?? 'DRAFT',
              publishedAt: t.status === PUBLISHED ? new Date() : null,
              seoTitle: t.seoTitle ?? null, seoDescription: t.seoDescription ?? null,
            })),
          },
        },
        select: { id: true },
      });
      await this.audit(actor, 'service.create', created.id, { slug: dto.slug, locales });
      return this.getAdmin(created.id);
    } catch (err) {
      this.rethrow(err);
    }
  }

  async update(id: string, dto: UpdateServiceDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.service.findUnique({
      where: { id },
      select: { id: true, slug: true, isActive: true, translations: { select: { locale: true, status: true, publishedAt: true } } },
    });
    if (!existing) throw new NotFoundException('Service not found');

    const incoming = dto.translations ?? [];
    const locales = incoming.map((t) => t.locale);
    this.assertUnique(locales);
    await this.assertLocalesEnabled(locales);

    const byLocale = new Map(existing.translations.map((t) => [t.locale, t]));
    for (const t of incoming) {
      if (!byLocale.has(t.locale) && (!t.name || !t.summary)) {
        throw new BadRequestException(`"name" and "summary" are required to add the "${t.locale}" translation`);
      }
    }

    // Anything that changes what visitors currently see needs the publish permission.
    const hasLive = existing.translations.some((t) => t.status === PUBLISHED);
    const serviceLevelChange =
      (dto.slug !== undefined && dto.slug !== existing.slug) || (dto.isActive !== undefined && dto.isActive !== existing.isActive);
    const touchesLive =
      (serviceLevelChange && hasLive) ||
      incoming.some((t) => t.status === PUBLISHED || byLocale.get(t.locale)?.status === PUBLISHED);
    if (touchesLive) this.requirePublish(actor);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.service.update({
          where: { id },
          data: {
            ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
            ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
        });
        for (const t of incoming) {
          const current = byLocale.get(t.locale);
          const becomesPublished = t.status === PUBLISHED && !(current?.status === PUBLISHED) && !current?.publishedAt;
          const data = {
            ...(t.name !== undefined ? { name: t.name } : {}),
            ...(t.summary !== undefined ? { summary: t.summary } : {}),
            ...(t.body !== undefined ? { body: asJson(t.body) } : {}),
            ...(t.status !== undefined ? { status: t.status } : {}),
            ...(t.seoTitle !== undefined ? { seoTitle: t.seoTitle } : {}),
            ...(t.seoDescription !== undefined ? { seoDescription: t.seoDescription } : {}),
            ...(becomesPublished ? { publishedAt: new Date() } : {}),
          };
          if (current) {
            await tx.serviceTranslation.update({ where: { serviceId_locale: { serviceId: id, locale: t.locale } }, data });
          } else {
            await tx.serviceTranslation.create({
              data: {
                serviceId: id, locale: t.locale, name: t.name as string, summary: t.summary as string,
                body: asJson(t.body ?? {}), status: t.status ?? 'DRAFT',
                publishedAt: t.status === PUBLISHED ? new Date() : null,
                seoTitle: t.seoTitle ?? null, seoDescription: t.seoDescription ?? null,
              },
            });
          }
        }
      });
    } catch (err) {
      this.rethrow(err);
    }
    await this.audit(actor, 'service.update', id, {
      fields: Object.keys(dto).filter((k) => k !== 'translations'), locales,
      statuses: Object.fromEntries(incoming.filter((t) => t.status).map((t) => [t.locale, t.status])),
    });
    return this.getAdmin(id);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const found = await this.prisma.service.findUnique({ where: { id }, select: { id: true, slug: true } });
    if (!found) throw new NotFoundException('Service not found');

    // The schema would silently SET NULL on these optional relations, losing lead/case-study attribution.
    const [leads, caseStudies] = await Promise.all([
      this.prisma.lead.count({ where: { serviceId: id } }),
      this.prisma.caseStudy.count({ where: { serviceId: id } }),
    ]);
    if (leads > 0 || caseStudies > 0) {
      throw new ConflictException('This service is referenced by leads or case studies. Set isActive to false instead of deleting it.');
    }
    try {
      await this.prisma.service.delete({ where: { id } }); // translations and FAQs cascade
    } catch (err) {
      this.rethrow(err);
    }
    await this.audit(actor, 'service.delete', id, { slug: found.slug });
  }

  // ───────────────────────── helpers ─────────────────────────

  private async resolveLocale(locale?: string): Promise<string> {
    if (locale) return locale;
    const def = await this.prisma.language.findFirst({ where: { isDefault: true, isEnabled: true }, select: { code: true } });
    return def?.code ?? FALLBACK_LOCALE;
  }

  /** "Visible to the public": translation PUBLISHED and already live, and the service is active. */
  private publicWhere(locale: string, q?: string) {
    const now = new Date();
    return {
      locale,
      status: PUBLISHED,
      service: { isActive: true },
      AND: [
        { OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
        ...(q
          ? [{ OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { summary: { contains: q, mode: 'insensitive' as const } }] }]
          : []),
      ],
    };
  }

  private publicOrderBy(sort: QueryServicesDto['sort'], dir: SortOrder) {
    const tie = { service: { slug: 'asc' as const } }; // deterministic ordering
    switch (sort) {
      case 'name': return [{ name: dir }, tie];
      case 'publishedAt': return [{ publishedAt: dir }, tie];
      default: return [{ service: { sortOrder: dir } }, tie];
    }
  }

  private assertUnique(locales: string[]): void {
    if (new Set(locales).size !== locales.length) throw new BadRequestException('Each locale may appear only once');
  }

  private async assertLocalesEnabled(locales: string[]): Promise<void> {
    if (!locales.length) return;
    const rows = await this.prisma.language.findMany({ where: { code: { in: locales }, isEnabled: true }, select: { code: true } });
    const ok = new Set(rows.map((r) => r.code));
    const bad = locales.filter((l) => !ok.has(l));
    if (bad.length) throw new BadRequestException(`Unknown or disabled locale: ${bad.join(', ')}`);
  }

  private requirePublish(actor: AuthenticatedUser): void {
    if (!actor.permissions.includes(SERVICE_PERMISSIONS.publish)) {
      throw new ForbiddenException('Publishing or changing live content requires the publish permission');
    }
  }

  private rethrow(err: unknown): never {
    switch (prismaCode(err)) {
      case 'P2002': throw new ConflictException('A service with this slug (or locale) already exists');
      case 'P2025': throw new NotFoundException('Service not found');
      case 'P2003': throw new ConflictException('The service is still referenced by other records');
      default: throw err;
    }
  }

  /** Never lets an audit failure break the admin action, but keeps it visible in logs. */
  private async audit(actor: AuthenticatedUser, action: string, entityId: string, diff: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: { actorId: actor.id, action, entityType: 'service', entityId, diff: diff as never } });
    } catch (err) {
      this.logger.error(`Audit log write failed for ${action}: ${(err as Error).message}`);
    }
  }
}
