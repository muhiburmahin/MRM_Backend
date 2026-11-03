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
import { AdminQueryProjectsDto, QueryProjectsDto } from './dto/query-projects.dto';
import { CreateProjectDto, UpdateProjectDto } from './dto/project-write.dto';
import { isMetricList } from './dto/validators';
import { EVIDENCE_NOTE_MIN, PROJECT_PERMISSIONS, SortOrder } from './projects.constants';
import { sanitizePublicProjectRepoLinks, visibility } from './projects.visibility';

const PUBLISHED = 'PUBLISHED' as const;
const FALLBACK_LOCALE = 'en';

const prismaCode = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined;

/** Prisma `Json` input type differs between versions; this single cast keeps the rest strictly typed. */
const asJson = (v: unknown): never => v as never;

const meta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

const altFor = (alt: unknown, locale: string, fallback: string): string => {
  if (typeof alt === 'object' && alt !== null) {
    const v = (alt as Record<string, unknown>)[locale];
    if (typeof v === 'string' && v) return v;
  }
  return fallback;
};

type MediaRow = { url: string; width: number | null; height: number | null; alt: unknown };

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Public ─────────────────────────

  async listPublic(query: QueryProjectsDto) {
    const locale = await this.resolveLocale(query.locale);
    const where = this.publicWhere(locale, query);
    const tie = { caseStudy: { slug: 'asc' as const } };
    const orderBy =
      query.sort === 'title'
        ? [{ title: query.order }, tie]
        : query.sort === 'publishedAt'
          ? [{ caseStudy: { publishedAt: query.order } }, tie]
          : [{ caseStudy: { sortOrder: query.order } }, tie];

    const [total, rows] = await Promise.all([
      this.prisma.caseStudyTranslation.count({ where }),
      this.prisma.caseStudyTranslation.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          title: true,
          summary: true,
          caseStudy: { select: this.publicCaseStudySelect(locale, false) },
        },
      }),
    ]);
    const media = await this.mediaMap(rows.flatMap((r) => [r.caseStudy.coverId]));
    return {
      data: rows.map((r) => {
        const sanitized = sanitizePublicProjectRepoLinks({
          frontendRepoUrl: r.caseStudy.frontendRepoUrl,
          backendRepoUrl: r.caseStudy.backendRepoUrl,
          showFrontendRepo: r.caseStudy.showFrontendRepo,
          showBackendRepo: r.caseStudy.showBackendRepo,
        });
        return {
          slug: r.caseStudy.slug,
          title: r.title,
          summary: r.summary,
          cover: this.imageOf(r.caseStudy.coverId, media, locale, r.title),
          publishedAt: r.caseStudy.publishedAt as Date,
          sortOrder: r.caseStudy.sortOrder,
          projectWorkStatus: r.caseStudy.projectWorkStatus,
          isFeatured: r.caseStudy.isFeatured,
          demoVideoUrl: r.caseStudy.demoVideoUrl,
          frontendRepoUrl: sanitized.frontendRepoUrl,
          backendRepoUrl: sanitized.backendRepoUrl,
          frontendTechSummary: r.caseStudy.frontendTechSummary,
          backendTechSummary: r.caseStudy.backendTechSummary,
          dbToolsSummary: r.caseStudy.dbToolsSummary,
          service: this.ref(r.caseStudy.service),
          industry: this.ref(r.caseStudy.industry),
          product: this.ref(r.caseStudy.product),
          clientName: this.disclosedClient(r.caseStudy.client)?.name ?? null,
        };
      }),
      meta: meta(query.page, query.limit, total),
    };
  }

  async getPublicBySlug(slug: string, localeParam?: string) {
    const locale = await this.resolveLocale(localeParam);
    const base = this.publicWhere(locale, {});
    const row = await this.prisma.caseStudyTranslation.findFirst({
      where: { ...base, caseStudy: { ...base.caseStudy, slug } },
      select: {
        locale: true,
        title: true,
        summary: true,
        challenge: true,
        solution: true,
        result: true,
        body: true,
        seoTitle: true,
        seoDescription: true,
        caseStudy: {
          select: {
            ...this.publicCaseStudySelect(locale, true),
            metrics: true,
            translations: { where: { status: PUBLISHED }, select: { locale: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Project not found');

    const cs = row.caseStudy;
    const client = this.disclosedClient(cs.client);
    const media = await this.mediaMap([cs.coverId, client?.logoId ?? null]);
    const sanitized = sanitizePublicProjectRepoLinks({
      frontendRepoUrl: cs.frontendRepoUrl,
      backendRepoUrl: cs.backendRepoUrl,
      showFrontendRepo: cs.showFrontendRepo,
      showBackendRepo: cs.showBackendRepo,
    });
    return {
      slug: cs.slug,
      locale: row.locale,
      title: row.title,
      summary: row.summary,
      challenge: row.challenge,
      solution: row.solution,
      result: row.result,
      body: row.body,
      cover: this.imageOf(cs.coverId, media, locale, row.title),
      publishedAt: cs.publishedAt as Date,
      sortOrder: cs.sortOrder,
      projectWorkStatus: cs.projectWorkStatus,
      isFeatured: cs.isFeatured,
      demoVideoUrl: cs.demoVideoUrl,
      frontendRepoUrl: sanitized.frontendRepoUrl,
      backendRepoUrl: sanitized.backendRepoUrl,
      frontendTechSummary: cs.frontendTechSummary,
      backendTechSummary: cs.backendTechSummary,
      dbToolsSummary: cs.dbToolsSummary,
      service: this.ref(cs.service),
      industry: this.ref(cs.industry),
      product: this.ref(cs.product),
      clientName: client?.name ?? null,
      client: client
        ? {
            name: client.name,
            websiteUrl: client.websiteUrl,
            logo: this.imageOf(client.logoId, media, locale, client.name),
          }
        : null,
      metrics: isMetricList(cs.metrics)
        ? cs.metrics.map((m) => ({ label: m.label, value: m.value }))
        : [],
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      availableLocales: cs.translations.map((t) => t.locale).sort(),
    };
  }

  // ───────────────────────── Admin ─────────────────────────

  async listAdmin(query: AdminQueryProjectsDto) {
    const search = query.q
      ? [
          { slug: { contains: query.q, mode: 'insensitive' as const } },
          {
            translations: { some: { title: { contains: query.q, mode: 'insensitive' as const } } },
          },
        ]
      : undefined;
    const where = {
      ...(query.isVerified !== undefined ? { isVerified: query.isVerified } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.industryId ? { industryId: query.industryId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.status ? { translations: { some: { status: query.status } } } : {}),
      ...(search ? { OR: search } : {}),
    };
    const dir: SortOrder = query.order;
    const orderBy = {
      sortOrder: { sortOrder: dir },
      slug: { slug: dir },
      publishedAt: { publishedAt: dir },
    }[query.sort];

    const [total, rows] = await Promise.all([
      this.prisma.caseStudy.count({ where }),
      this.prisma.caseStudy.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: this.adminSelect(false),
      }),
    ]);
    return {
      data: rows.map((r) => ({ ...r, visibility: visibility(r) })),
      meta: meta(query.page, query.limit, total),
    };
  }

  async getAdmin(id: string) {
    const row = await this.prisma.caseStudy.findUnique({
      where: { id },
      select: this.adminSelect(true),
    });
    if (!row) throw new NotFoundException('Project not found');
    return { ...row, visibility: visibility(row) };
  }

  async create(dto: CreateProjectDto, actor: AuthenticatedUser) {
    const locales = dto.translations.map((t) => t.locale);
    this.assertUnique(locales);
    await this.assertLocalesEnabled(locales);
    await this.assertCoverExists(dto.coverId);
    this.assertTrustRules({
      isVerified: dto.isVerified ?? false,
      evidenceNote: dto.evidenceNote ?? null,
      clientId: dto.clientId ?? null,
      clientApprovedAt: dto.clientApprovedAt ?? null,
    });

    const publishing = dto.translations.some((t) => t.status === PUBLISHED);
    const trustFields = this.touchesTrust(dto);
    if (publishing || trustFields) this.requirePublish(actor);

    try {
      const created = await this.prisma.caseStudy.create({
        data: {
          slug: dto.slug,
          clientId: dto.clientId ?? null,
          productId: dto.productId ?? null,
          serviceId: dto.serviceId ?? null,
          industryId: dto.industryId ?? null,
          coverId: dto.coverId ?? null,
          metrics: asJson(dto.metrics ?? []),
          isVerified: dto.isVerified ?? false,
          evidenceNote: dto.evidenceNote ?? null,
          clientApprovedAt: dto.clientApprovedAt ?? null,
          publishedAt:
            dto.publishedAt !== undefined ? dto.publishedAt : publishing ? new Date() : null,
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          projectWorkStatus: dto.projectWorkStatus ?? 'COMPLETED',
          isFeatured: dto.isFeatured ?? false,
          demoVideoUrl: dto.demoVideoUrl ?? null,
          frontendRepoUrl: dto.frontendRepoUrl ?? null,
          backendRepoUrl: dto.backendRepoUrl ?? null,
          showFrontendRepo: dto.showFrontendRepo ?? false,
          showBackendRepo: dto.showBackendRepo ?? false,
          frontendTechSummary:
            dto.frontendTechSummary !== undefined ? asJson(dto.frontendTechSummary) : undefined,
          backendTechSummary:
            dto.backendTechSummary !== undefined ? asJson(dto.backendTechSummary) : undefined,
          dbToolsSummary: dto.dbToolsSummary !== undefined ? asJson(dto.dbToolsSummary) : undefined,
          translations: {
            create: dto.translations.map((t) => ({
              locale: t.locale,
              title: t.title,
              summary: t.summary,
              challenge: t.challenge ?? null,
              solution: t.solution ?? null,
              result: t.result ?? null,
              body: asJson(t.body ?? {}),
              status: t.status ?? 'DRAFT',
              seoTitle: t.seoTitle ?? null,
              seoDescription: t.seoDescription ?? null,
            })),
          },
        },
        select: { id: true },
      });
      await this.audit(actor, 'project.create', created.id, {
        slug: dto.slug,
        locales,
        trustFields,
      });
      return this.getAdmin(created.id);
    } catch (err) {
      this.rethrow(err, true);
    }
  }

  async update(id: string, dto: UpdateProjectDto, actor: AuthenticatedUser) {
    const cur = await this.prisma.caseStudy.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        isVerified: true,
        evidenceNote: true,
        publishedAt: true,
        clientId: true,
        clientApprovedAt: true,
        translations: { select: { locale: true, status: true } },
      },
    });
    if (!cur) throw new NotFoundException('Project not found');

    const incoming = dto.translations ?? [];
    const locales = incoming.map((t) => t.locale);
    this.assertUnique(locales);
    await this.assertLocalesEnabled(locales);
    await this.assertCoverExists(dto.coverId);

    const have = new Set(cur.translations.map((t) => t.locale));
    for (const t of incoming) {
      if (!have.has(t.locale) && (!t.title || !t.summary)) {
        throw new BadRequestException(
          `"title" and "summary" are required to add the "${t.locale}" translation`,
        );
      }
    }
    this.assertTrustRules({
      isVerified: dto.isVerified ?? cur.isVerified,
      evidenceNote: dto.evidenceNote !== undefined ? dto.evidenceNote : cur.evidenceNote,
      clientId: dto.clientId !== undefined ? dto.clientId : cur.clientId,
      clientApprovedAt:
        dto.clientApprovedAt !== undefined ? dto.clientApprovedAt : cur.clientApprovedAt,
    });

    // Trust decisions and anything touching approved/published content need the publish permission.
    const hadPublished = cur.translations.some((t) => t.status === PUBLISHED);
    const onlyOrdering = Object.keys(dto).every((k) => k === 'sortOrder');
    const newlyPublishing = incoming.some((t) => t.status === PUBLISHED);
    if (this.touchesTrust(dto) || newlyPublishing || (hadPublished && !onlyOrdering))
      this.requirePublish(actor);

    const setPublishedAt =
      dto.publishedAt !== undefined
        ? dto.publishedAt
        : newlyPublishing && !cur.publishedAt
          ? new Date()
          : undefined;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.caseStudy.update({
          where: { id },
          data: {
            ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
            ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
            ...(dto.productId !== undefined ? { productId: dto.productId } : {}),
            ...(dto.serviceId !== undefined ? { serviceId: dto.serviceId } : {}),
            ...(dto.industryId !== undefined ? { industryId: dto.industryId } : {}),
            ...(dto.coverId !== undefined ? { coverId: dto.coverId } : {}),
            ...(dto.metrics !== undefined ? { metrics: asJson(dto.metrics) } : {}),
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
            ...(dto.projectWorkStatus !== undefined
              ? { projectWorkStatus: dto.projectWorkStatus }
              : {}),
            ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
            ...(dto.demoVideoUrl !== undefined ? { demoVideoUrl: dto.demoVideoUrl } : {}),
            ...(dto.frontendRepoUrl !== undefined ? { frontendRepoUrl: dto.frontendRepoUrl } : {}),
            ...(dto.backendRepoUrl !== undefined ? { backendRepoUrl: dto.backendRepoUrl } : {}),
            ...(dto.showFrontendRepo !== undefined
              ? { showFrontendRepo: dto.showFrontendRepo }
              : {}),
            ...(dto.showBackendRepo !== undefined ? { showBackendRepo: dto.showBackendRepo } : {}),
            ...(dto.frontendTechSummary !== undefined
              ? { frontendTechSummary: asJson(dto.frontendTechSummary) }
              : {}),
            ...(dto.backendTechSummary !== undefined
              ? { backendTechSummary: asJson(dto.backendTechSummary) }
              : {}),
            ...(dto.dbToolsSummary !== undefined
              ? { dbToolsSummary: asJson(dto.dbToolsSummary) }
              : {}),
            ...(dto.isVerified !== undefined ? { isVerified: dto.isVerified } : {}),
            ...(dto.evidenceNote !== undefined ? { evidenceNote: dto.evidenceNote } : {}),
            ...(dto.clientApprovedAt !== undefined
              ? { clientApprovedAt: dto.clientApprovedAt }
              : {}),
            ...(setPublishedAt !== undefined ? { publishedAt: setPublishedAt } : {}),
          },
        });
        for (const t of incoming) {
          const data = {
            ...(t.title !== undefined ? { title: t.title } : {}),
            ...(t.summary !== undefined ? { summary: t.summary } : {}),
            ...(t.challenge !== undefined ? { challenge: t.challenge } : {}),
            ...(t.solution !== undefined ? { solution: t.solution } : {}),
            ...(t.result !== undefined ? { result: t.result } : {}),
            ...(t.body !== undefined ? { body: asJson(t.body) } : {}),
            ...(t.status !== undefined ? { status: t.status } : {}),
            ...(t.seoTitle !== undefined ? { seoTitle: t.seoTitle } : {}),
            ...(t.seoDescription !== undefined ? { seoDescription: t.seoDescription } : {}),
          };
          if (have.has(t.locale)) {
            await tx.caseStudyTranslation.update({
              where: { caseStudyId_locale: { caseStudyId: id, locale: t.locale } },
              data,
            });
          } else {
            await tx.caseStudyTranslation.create({
              data: {
                caseStudyId: id,
                locale: t.locale,
                title: t.title as string,
                summary: t.summary as string,
                challenge: t.challenge ?? null,
                solution: t.solution ?? null,
                result: t.result ?? null,
                body: asJson(t.body ?? {}),
                status: t.status ?? 'DRAFT',
                seoTitle: t.seoTitle ?? null,
                seoDescription: t.seoDescription ?? null,
              },
            });
          }
        }
      });
    } catch (err) {
      this.rethrow(err, true);
    }
    await this.audit(actor, 'project.update', id, {
      fields: Object.keys(dto).filter((k) => k !== 'translations'),
      locales,
      statuses: Object.fromEntries(
        incoming.filter((t) => t.status).map((t) => [t.locale, t.status]),
      ),
    });
    return this.getAdmin(id);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const found = await this.prisma.caseStudy.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!found) throw new NotFoundException('Project not found');
    try {
      await this.prisma.caseStudy.delete({ where: { id } }); // translations cascade; nothing else references a case study
    } catch (err) {
      this.rethrow(err, false);
    }
    await this.audit(actor, 'project.delete', id, { slug: found.slug });
  }

  // ───────────────────────── helpers ─────────────────────────

  /**
   * THE definition of "publicly visible" (keep in sync with projects.visibility.ts):
   * verified + evidence recorded + go-live date reached + (client approved if a client is linked)
   * + translation PUBLISHED in the requested locale.
   */
  private publicWhere(
    locale: string,
    f: { q?: string; service?: string; industry?: string; product?: string },
  ) {
    const now = new Date();
    return {
      locale,
      status: PUBLISHED,
      caseStudy: {
        isVerified: true,
        AND: [
          { evidenceNote: { not: null } },
          { evidenceNote: { not: '' } },
          { publishedAt: { not: null } },
          { publishedAt: { lte: now } },
          { OR: [{ clientId: null }, { clientApprovedAt: { not: null } }] },
        ],
        ...(f.service ? { service: { slug: f.service } } : {}),
        ...(f.industry ? { industry: { slug: f.industry } } : {}),
        ...(f.product ? { product: { slug: f.product } } : {}),
      },
      ...(f.q
        ? {
            OR: [
              { title: { contains: f.q, mode: 'insensitive' as const } },
              { summary: { contains: f.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  /** Explicit public selection; evidenceNote, isVerified, ids and approval dates are never selected. */
  private publicCaseStudySelect(locale: string, withClientLogo: boolean) {
    return {
      slug: true,
      coverId: true,
      publishedAt: true,
      sortOrder: true,
      projectWorkStatus: true,
      isFeatured: true,
      demoVideoUrl: true,
      frontendRepoUrl: true,
      backendRepoUrl: true,
      showFrontendRepo: true,
      showBackendRepo: true,
      frontendTechSummary: true,
      backendTechSummary: true,
      dbToolsSummary: true,
      service: {
        select: {
          slug: true,
          translations: { where: { locale, status: PUBLISHED }, select: { name: true }, take: 1 },
        },
      },
      industry: {
        select: {
          slug: true,
          translations: { where: { locale, status: PUBLISHED }, select: { name: true }, take: 1 },
        },
      },
      product: {
        select: {
          slug: true,
          translations: { where: { locale, status: PUBLISHED }, select: { name: true }, take: 1 },
        },
      },
      client: {
        select: {
          name: true,
          websiteUrl: true,
          logoId: withClientLogo,
          isVerified: true,
          permissionGrantedAt: true,
          showOnSite: true,
        },
      },
    };
  }

  private ref(r: { slug: string; translations: Array<{ name: string }> } | null) {
    return r ? { slug: r.slug, name: r.translations[0]?.name ?? null } : null;
  }

  /** A client is named publicly only if verified, permission granted AND showOnSite. */
  private disclosedClient(
    c: {
      name: string;
      websiteUrl: string | null;
      logoId?: string | null;
      isVerified: boolean;
      permissionGrantedAt: Date | null;
      showOnSite: boolean;
    } | null,
  ) {
    if (!c || !c.isVerified || !c.permissionGrantedAt || !c.showOnSite) return null;
    return { name: c.name, websiteUrl: c.websiteUrl, logoId: c.logoId ?? null };
  }

  private adminSelect(withBodies: boolean) {
    return {
      id: true,
      slug: true,
      clientId: true,
      productId: true,
      serviceId: true,
      industryId: true,
      coverId: true,
      metrics: true,
      isVerified: true,
      evidenceNote: true,
      clientApprovedAt: true,
      publishedAt: true,
      sortOrder: true,
      projectWorkStatus: true,
      isFeatured: true,
      demoVideoUrl: true,
      frontendRepoUrl: true,
      backendRepoUrl: true,
      showFrontendRepo: true,
      showBackendRepo: true,
      frontendTechSummary: true,
      backendTechSummary: true,
      dbToolsSummary: true,
      translations: {
        select: withBodies
          ? {
              locale: true,
              title: true,
              summary: true,
              challenge: true,
              solution: true,
              result: true,
              body: true,
              status: true,
              seoTitle: true,
              seoDescription: true,
            }
          : { locale: true, title: true, status: true },
        orderBy: { locale: 'asc' as const },
      },
    };
  }

  private touchesTrust(dto: {
    isVerified?: boolean;
    evidenceNote?: string | null;
    clientApprovedAt?: Date | null;
    publishedAt?: Date | null;
  }): boolean {
    return (
      dto.isVerified !== undefined ||
      dto.evidenceNote !== undefined ||
      dto.clientApprovedAt !== undefined ||
      dto.publishedAt !== undefined
    );
  }

  private assertTrustRules(f: {
    isVerified: boolean;
    evidenceNote: string | null;
    clientId: string | null;
    clientApprovedAt: Date | null;
  }): void {
    if (f.isVerified && (f.evidenceNote ?? '').trim().length < EVIDENCE_NOTE_MIN) {
      throw new BadRequestException(
        `isVerified requires an evidenceNote of at least ${EVIDENCE_NOTE_MIN} characters`,
      );
    }
    if (f.clientApprovedAt && !f.clientId)
      throw new BadRequestException('clientApprovedAt requires a clientId');
  }

  private async resolveLocale(locale?: string): Promise<string> {
    if (locale) return locale;
    const def = await this.prisma.language.findFirst({
      where: { isDefault: true, isEnabled: true },
      select: { code: true },
    });
    return def?.code ?? FALLBACK_LOCALE;
  }

  /** coverId / logoId are intentional plain UUIDs (no FK): resolve them with ONE batched lookup. */
  private async mediaMap(ids: Array<string | null | undefined>) {
    const unique = [...new Set(ids.filter((i): i is string => !!i))];
    const map = new Map<string, MediaRow>();
    if (!unique.length) return map;
    const rows = await this.prisma.mediaAsset.findMany({
      where: { id: { in: unique } },
      select: { id: true, url: true, width: true, height: true, alt: true },
    });
    rows.forEach((r) => map.set(r.id, r));
    return map;
  }

  private imageOf(
    id: string | null | undefined,
    media: Map<string, MediaRow>,
    locale: string,
    fallbackAlt: string,
  ) {
    const m = id ? media.get(id) : undefined;
    return m
      ? { url: m.url, width: m.width, height: m.height, alt: altFor(m.alt, locale, fallbackAlt) }
      : null;
  }

  private async assertCoverExists(coverId?: string | null): Promise<void> {
    if (!coverId) return;
    const found = await this.prisma.mediaAsset.findUnique({
      where: { id: coverId },
      select: { id: true },
    });
    if (!found) throw new BadRequestException('coverId does not match an existing media asset');
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
    if (!actor.permissions.includes(PROJECT_PERMISSIONS.publish)) {
      throw new ForbiddenException(
        'Verification, publishing and changes to published projects require the publish permission',
      );
    }
  }

  /** `writing`: a foreign-key failure on create/update means an invalid client/product/service/industry id. */
  private rethrow(err: unknown, writing: boolean): never {
    switch (prismaCode(err)) {
      case 'P2002':
        throw new ConflictException('A project with this slug (or locale) already exists');
      case 'P2025':
        throw new NotFoundException('Project not found');
      case 'P2003':
        throw writing
          ? new BadRequestException(
              'clientId, productId, serviceId or industryId does not match an existing record',
            )
          : new ConflictException('The project is still referenced by other records');
      default:
        throw err;
    }
  }

  /** Field names only: never write evidence notes or content into the audit log. */
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
          entityType: 'case_study',
          entityId,
          diff: diff as never,
        },
      });
    } catch (err) {
      this.logger.error(`Audit log write failed for ${action}: ${(err as Error).message}`);
    }
  }
}
