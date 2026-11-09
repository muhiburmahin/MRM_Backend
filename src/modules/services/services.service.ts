import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AdminQueryServicesDto, QueryServicesDto } from './dto/query-services.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ReorderServicesDto } from './dto/reorder-services.dto';
import { ServiceSection } from './dto/update-service-section.dto';
import type { ServiceSectionPayload } from './dto/service-section-payload';
import { SERVICE_PERMISSIONS } from './services.constants';

const PUBLISHED = ContentStatus.PUBLISHED;

const prismaCode = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined;

const asJson = (v: Record<string, unknown>): never => v as never;

const meta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

type ServiceWithRelations = Prisma.ServiceGetPayload<{
  include: {
    category: true;
    offerings: true;
    benefits: true;
    processSteps: true;
    mediaGallery: true;
    serviceFaqs: true;
    technologies: { include: { technology: true } };
    caseStudies: true;
  };
}>;

/** A service row as returned by the various queries: relations are present only when that query included them. */
type ServiceRow = Pick<ServiceWithRelations, 'id' | 'slug'> &
  Partial<Omit<ServiceWithRelations, 'id' | 'slug' | 'technologies' | 'caseStudies'>> & {
    technologies?: Array<{ technologyId?: string; technology?: ServiceWithRelations['technologies'][number]['technology'] | null }>;
    caseStudies?: unknown[];
    _count?: { leads?: number; caseStudies?: number };
  };

type RelatedServiceRow = Prisma.ServiceGetPayload<{
  select: {
    id: true;
    slug: true;
    title: true;
    name: true;
    tagline: true;
    shortDescription: true;
    icon: true;
    coverImage: true;
    coverImageUrl: true;
    category: { select: { id: true; name: true; slug: true } };
  };
}>;

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Public Endpoints ─────────────────────────

  async listPublic(query: QueryServicesDto) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const placement = query.placement || 'catalog';

    const where: Prisma.ServiceWhereInput = {
      status: PUBLISHED,
      isActive: true,
    };

    if (placement === 'homepage') {
      where.showOnHomepage = true;
    } else if (placement === 'nav') {
      where.showInNavbar = true;
    } else {
      where.showOnServicesPage = true;
    }

    if (query.category) {
      where.category = {
        OR: [{ slug: query.category }, { id: query.category }],
      };
    }

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { name: { contains: query.q, mode: 'insensitive' } },
        { shortDescription: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    let orderBy: Prisma.ServiceOrderByWithRelationInput[];
    if (placement === 'homepage') {
      orderBy = [{ homepageOrder: 'asc' }, { servicesPageOrder: 'asc' }];
    } else if (placement === 'nav') {
      orderBy = [{ navbarOrder: 'asc' }, { servicesPageOrder: 'asc' }];
    } else {
      orderBy = [{ isFeatured: 'desc' }, { servicesPageOrder: 'asc' }, { sortOrder: 'asc' }];
    }

    const isMinimalPlacement = placement === 'homepage' || placement === 'nav';

    const [total, services] = await Promise.all([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: true,
          offerings: {
            where: { isVisible: true },
            orderBy: { displayOrder: 'asc' },
          },
          ...(isMinimalPlacement
            ? {}
            : {
                benefits: {
                  where: { isVisible: true },
                  orderBy: { displayOrder: 'asc' },
                },
                processSteps: {
                  orderBy: { displayOrder: 'asc' },
                },
                mediaGallery: {
                  orderBy: { displayOrder: 'asc' },
                },
                technologies: {
                  include: { technology: true },
                },
              }),
        },
      }),
    ]);

    const data = services.map((s) => this.toPublicSummary(s));

    return {
      data,
      meta: meta(page, limit, total),
    };
  }

  async getPublicBySlug(slug: string, _localeParam?: string) {
    const service = await this.prisma.service.findFirst({
      where: {
        slug,
        status: PUBLISHED,
        allowPublicDetail: true,
        isActive: true,
      },
      include: {
        category: true,
        offerings: {
          where: { isVisible: true },
          orderBy: { displayOrder: 'asc' },
        },
        benefits: {
          where: { isVisible: true },
          orderBy: { displayOrder: 'asc' },
        },
        processSteps: {
          orderBy: { displayOrder: 'asc' },
        },
        mediaGallery: {
          orderBy: { displayOrder: 'asc' },
        },
        serviceFaqs: {
          where: { isVisible: true },
          orderBy: { displayOrder: 'asc' },
        },
        technologies: {
          include: { technology: true },
        },
        caseStudies: {
          where: { isVerified: true },
          include: { client: true, technologies: true, gallery: true },
          take: 4,
        },
      },
    });

    if (!service) {
      throw new NotFoundException(`Service "${slug}" not found or currently unavailable.`);
    }

    // Related services (same category or top featured services)
    const related = await this.prisma.service.findMany({
      where: {
        id: { not: service.id },
        status: PUBLISHED,
        showOnServicesPage: true,
        isActive: true,
        ...(service.categoryId ? { categoryId: service.categoryId } : {}),
      },
      orderBy: [{ isFeatured: 'desc' }, { servicesPageOrder: 'asc' }],
      take: 3,
      select: {
        id: true,
        slug: true,
        title: true,
        name: true,
        tagline: true,
        shortDescription: true,
        icon: true,
        coverImage: true,
        coverImageUrl: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    return this.toPublicDetail(service, related);
  }

  async getCategoriesPublic() {
    return this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { services: { where: { status: PUBLISHED, isActive: true } } },
        },
      },
    });
  }

  // ───────────────────────── Admin Endpoints ─────────────────────────

  async listAdmin(query: AdminQueryServicesDto) {
    const page = query.page || 1;
    const limit = query.limit || 50;

    const where: Prisma.ServiceWhereInput = {};

    if (query.status) {
      where.status = query.status as ContentStatus;
    }

    if (query.isFeatured !== undefined) {
      where.isFeatured = query.isFeatured;
    }

    if (query.category) {
      where.category = {
        OR: [{ slug: query.category }, { id: query.category }],
      };
    }

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { name: { contains: query.q, mode: 'insensitive' } },
        { shortDescription: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [total, published, draft, featured, comingSoon, archived, services] = await Promise.all([
      this.prisma.service.count(),
      this.prisma.service.count({ where: { status: ContentStatus.PUBLISHED } }),
      this.prisma.service.count({ where: { status: ContentStatus.DRAFT } }),
      this.prisma.service.count({ where: { isFeatured: true } }),
      this.prisma.service.count({ where: { status: ContentStatus.IN_REVIEW } }),
      this.prisma.service.count({ where: { status: ContentStatus.ARCHIVED } }),
      this.prisma.service.findMany({
        where,
        orderBy: [{ servicesPageOrder: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: true,
          offerings: { orderBy: { displayOrder: 'asc' } },
          benefits: { orderBy: { displayOrder: 'asc' } },
          processSteps: { orderBy: { displayOrder: 'asc' } },
          mediaGallery: { orderBy: { displayOrder: 'asc' } },
          serviceFaqs: { orderBy: { displayOrder: 'asc' } },
          _count: { select: { leads: true, caseStudies: true } },
        },
      }),
    ]);

    const data = services.map((s) => this.toAdminSummary(s));

    return {
      data,
      kpi: {
        total,
        published,
        draft,
        featured,
        comingSoon,
        archived,
      },
      meta: meta(page, limit, total),
    };
  }

  async getAdmin(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        category: true,
        offerings: { orderBy: { displayOrder: 'asc' } },
        benefits: { orderBy: { displayOrder: 'asc' } },
        processSteps: { orderBy: { displayOrder: 'asc' } },
        mediaGallery: { orderBy: { displayOrder: 'asc' } },
        serviceFaqs: { orderBy: { displayOrder: 'asc' } },
        technologies: { include: { technology: true } },
        caseStudies: { select: { id: true, slug: true, isFeatured: true } },
        _count: { select: { leads: true, caseStudies: true } },
      },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID "${id}" not found.`);
    }

    return this.toAdminDetail(service);
  }

  async create(dto: CreateServiceDto, actor: AuthenticatedUser) {
    if (dto.translations && dto.translations.length > 0) {
      this.assertUnique(dto.translations.map((t) => t.locale));
      await this.assertLocalesEnabled(dto.translations.map((t) => t.locale));
    }

    const effectiveStatus =
      (dto.status as ContentStatus) ||
      (dto.translations?.[0]?.status as ContentStatus) ||
      ContentStatus.DRAFT;

    const isPublishing =
      effectiveStatus === ContentStatus.PUBLISHED ||
      dto.translations?.some((t) => t.status === ContentStatus.PUBLISHED);

    if (isPublishing) {
      this.requirePublish(actor);
    }

    const title = dto.title || dto.name || dto.slug;
    const shortDesc = dto.shortDescription || dto.description || '';
    const fullDesc = dto.fullDescription || dto.description || shortDesc;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const svc = await tx.service.create({
          data: {
            slug: dto.slug,
            title,
            name: title,
            tagline: dto.tagline,
            shortDescription: shortDesc,
            description: fullDesc,
            fullDescription: fullDesc,
            problemSolved: dto.problemSolved || dto.problemsAddressed,
            problemsAddressed: dto.problemsAddressed || dto.problemSolved,
            targetAudience: dto.targetAudience,
            ourApproachSummary: dto.ourApproachSummary || dto.approach,
            approach: dto.approach || dto.ourApproachSummary,
            serviceType: dto.serviceType || 'Custom Engineering',
            brandColor: dto.brandColor,
            coverImage: dto.coverImage || dto.coverImageUrl,
            coverImageUrl: dto.coverImageUrl || dto.coverImage,
            thumbnailImage: dto.thumbnailImage || dto.thumbnailUrl,
            thumbnailUrl: dto.thumbnailUrl || dto.thumbnailImage,
            icon: dto.icon || 'Code2',
            status: (dto.status as ContentStatus) || ContentStatus.PUBLISHED,
            isFeatured: dto.isFeatured ?? false,
            showOnServicesPage: dto.showOnServicesPage ?? true,
            showOnHomepage: dto.showOnHomepage ?? false,
            showInNavbar: dto.showInNavbar ?? true,
            showInNavDropdown: dto.showInNavDropdown ?? dto.showInNavbar ?? true,
            allowPublicDetail: dto.allowPublicDetail ?? true,
            servicesPageOrder: dto.servicesPageOrder ?? 0,
            homepageOrder: dto.homepageOrder ?? 0,
            navbarOrder: dto.navbarOrder ?? 0,
            featuredOrder: dto.featuredOrder ?? 0,
            sortOrder: dto.sortOrder ?? dto.servicesPageOrder ?? 0,
            primaryCtaLabel: dto.primaryCtaLabel || 'Start a Project',
            secondaryCtaLabel: dto.secondaryCtaLabel || 'Request a Consultation',
            seoTitle: dto.seoTitle || `${title} | MRM InfoTech`,
            metaDescription: dto.metaDescription || dto.seoDescription || shortDesc,
            seoDescription: dto.seoDescription || dto.metaDescription || shortDesc,
            seoKeywords: dto.seoKeywords,
            keywords: dto.keywords || [],
            canonicalUrl: dto.canonicalUrl,
            ogTitle: dto.ogTitle || title,
            ogDescription: dto.ogDescription || shortDesc,
            ogImage: dto.ogImage || dto.coverImageUrl || dto.coverImage,
            twitterImage: dto.twitterImage,
            noIndex: dto.noIndex ?? false,
            includeInSitemap: dto.includeInSitemap ?? true,
            categoryId: dto.categoryId,
            translations: {
              create:
                dto.translations && dto.translations.length > 0
                  ? dto.translations.map((t) => {
                      const tStatus = (t.status as ContentStatus) || effectiveStatus;
                      return {
                        locale: t.locale,
                        name: t.name || title,
                        summary: t.summary || shortDesc,
                        body: t.body ? asJson(t.body) : asJson({ fullDescription: fullDesc }),
                        status: tStatus,
                        publishedAt: tStatus === ContentStatus.PUBLISHED ? new Date() : null,
                        seoTitle: t.seoTitle || dto.seoTitle,
                        seoDescription:
                          t.seoDescription ||
                          dto.metaDescription ||
                          dto.seoDescription ||
                          shortDesc,
                      };
                    })
                  : [
                      {
                        locale: 'en',
                        name: title,
                        summary: shortDesc,
                        body: asJson({ fullDescription: fullDesc }),
                        status: effectiveStatus,
                        publishedAt:
                          effectiveStatus === ContentStatus.PUBLISHED ? new Date() : null,
                        seoTitle: dto.seoTitle,
                        seoDescription: dto.metaDescription || dto.seoDescription || shortDesc,
                      },
                    ],
            },
          },
        });

        // Insert sub-collections if provided
        if (dto.offerings && dto.offerings.length > 0) {
          await tx.serviceOfferingItem.createMany({
            data: dto.offerings.map((off, idx) => ({
              serviceId: svc.id,
              title: off.title,
              shortDescription: off.shortDescription,
              detailedDescription: off.detailedDescription,
              icon: off.icon,
              imageUrl: off.imageUrl,
              displayOrder: off.displayOrder ?? idx + 1,
              isVisible: off.isVisible ?? true,
            })),
          });
        }

        if (dto.benefits && dto.benefits.length > 0) {
          await tx.serviceBenefitItem.createMany({
            data: dto.benefits.map((b, idx) => ({
              serviceId: svc.id,
              title: b.title,
              description: b.description,
              icon: b.icon,
              imageUrl: b.imageUrl,
              displayOrder: b.displayOrder ?? idx + 1,
              isVisible: b.isVisible ?? true,
            })),
          });
        }

        if (dto.processSteps && dto.processSteps.length > 0) {
          await tx.serviceProcessStepItem.createMany({
            data: dto.processSteps.map((p, idx) => ({
              serviceId: svc.id,
              stepNumber: p.stepNumber ?? idx + 1,
              title: p.title,
              description: p.description,
              icon: p.icon,
              displayOrder: p.displayOrder ?? idx + 1,
            })),
          });
        }

        if (dto.mediaGallery && dto.mediaGallery.length > 0) {
          await tx.serviceMediaItem.createMany({
            data: dto.mediaGallery.map((m, idx) => ({
              serviceId: svc.id,
              url: m.url,
              videoUrl: m.videoUrl,
              mediaType: m.mediaType || 'SCREENSHOT',
              title: m.title,
              caption: m.caption,
              altText: m.altText || m.title || 'Service preview screenshot',
              description: m.description,
              isCover: m.isCover ?? idx === 0,
              isPrimary: m.isPrimary ?? idx === 0,
              displayOrder: m.displayOrder ?? idx + 1,
            })),
          });
        }

        if (dto.serviceFaqs && dto.serviceFaqs.length > 0) {
          await tx.serviceFaqItem.createMany({
            data: dto.serviceFaqs.map((faq, idx) => ({
              serviceId: svc.id,
              question: faq.question,
              answer: faq.answer,
              displayOrder: faq.displayOrder ?? idx + 1,
              isVisible: faq.isVisible ?? true,
            })),
          });
        }

        return svc;
      });

      await this.audit(actor, 'service.create', created.id, { slug: created.slug });
      return this.getAdmin(created.id);
    } catch (err) {
      this.rethrow(err);
    }
  }

  async update(id: string, dto: UpdateServiceDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.service.findUnique({
      where: { id },
      include: {
        offerings: true,
        benefits: true,
        processSteps: true,
        mediaGallery: true,
        serviceFaqs: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Service with ID "${id}" not found.`);
    }

    if (dto.status === ContentStatus.PUBLISHED && existing.status !== ContentStatus.PUBLISHED) {
      this.requirePublish(actor);
    }

    if (existing.status === ContentStatus.PUBLISHED) {
      const touchingLive =
        dto.slug !== undefined ||
        dto.title !== undefined ||
        dto.name !== undefined ||
        dto.isActive !== undefined ||
        (dto.translations && dto.translations.length > 0) ||
        dto.shortDescription !== undefined ||
        dto.description !== undefined;
      if (touchingLive) {
        this.requirePublish(actor);
      }
    }

    if (dto.translations && dto.translations.length > 0) {
      this.assertUnique(dto.translations.map((t) => t.locale));
      await this.assertLocalesEnabled(dto.translations.map((t) => t.locale));
      for (const t of dto.translations) {
        if (t.locale !== 'en' && (!t.name || !t.summary)) {
          throw new BadRequestException(
            `Translation for "${t.locale}" requires both name and summary`,
          );
        }
      }
    }

    const title = dto.title || dto.name || existing.title || existing.name;
    const shortDesc = dto.shortDescription || dto.description || existing.shortDescription;
    const fullDesc =
      dto.fullDescription || dto.description || existing.fullDescription || shortDesc;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.service.update({
          where: { id },
          data: {
            slug: dto.slug,
            title,
            name: title,
            tagline: dto.tagline,
            shortDescription: shortDesc,
            description: fullDesc,
            fullDescription: fullDesc,
            problemSolved: dto.problemSolved || dto.problemsAddressed,
            problemsAddressed: dto.problemsAddressed || dto.problemSolved,
            targetAudience: dto.targetAudience,
            ourApproachSummary: dto.ourApproachSummary || dto.approach,
            approach: dto.approach || dto.ourApproachSummary,
            serviceType: dto.serviceType,
            brandColor: dto.brandColor,
            coverImage: dto.coverImage || dto.coverImageUrl,
            coverImageUrl: dto.coverImageUrl || dto.coverImage,
            thumbnailImage: dto.thumbnailImage || dto.thumbnailUrl,
            thumbnailUrl: dto.thumbnailUrl || dto.thumbnailImage,
            icon: dto.icon,
            status: dto.status as ContentStatus,
            isFeatured: dto.isFeatured,
            showOnServicesPage: dto.showOnServicesPage,
            showOnHomepage: dto.showOnHomepage,
            showInNavbar: dto.showInNavbar,
            showInNavDropdown: dto.showInNavDropdown ?? dto.showInNavbar,
            allowPublicDetail: dto.allowPublicDetail,
            servicesPageOrder: dto.servicesPageOrder,
            homepageOrder: dto.homepageOrder,
            navbarOrder: dto.navbarOrder,
            featuredOrder: dto.featuredOrder,
            sortOrder: dto.sortOrder ?? dto.servicesPageOrder,
            primaryCtaLabel: dto.primaryCtaLabel,
            secondaryCtaLabel: dto.secondaryCtaLabel,
            seoTitle: dto.seoTitle,
            metaDescription: dto.metaDescription || dto.seoDescription,
            seoDescription: dto.seoDescription || dto.metaDescription,
            seoKeywords: dto.seoKeywords,
            keywords: dto.keywords,
            canonicalUrl: dto.canonicalUrl,
            ogTitle: dto.ogTitle,
            ogDescription: dto.ogDescription,
            ogImage: dto.ogImage,
            twitterImage: dto.twitterImage,
            noIndex: dto.noIndex,
            includeInSitemap: dto.includeInSitemap,
            categoryId: dto.categoryId,
          },
        });

        // Sync Sub-collections
        if (dto.offerings) {
          await tx.serviceOfferingItem.deleteMany({ where: { serviceId: id } });
          if (dto.offerings.length > 0) {
            await tx.serviceOfferingItem.createMany({
              data: dto.offerings.map((off, idx) => ({
                serviceId: id,
                title: off.title,
                shortDescription: off.shortDescription,
                detailedDescription: off.detailedDescription,
                icon: off.icon,
                imageUrl: off.imageUrl,
                displayOrder: off.displayOrder ?? idx + 1,
                isVisible: off.isVisible ?? true,
              })),
            });
          }
        }

        if (dto.benefits) {
          await tx.serviceBenefitItem.deleteMany({ where: { serviceId: id } });
          if (dto.benefits.length > 0) {
            await tx.serviceBenefitItem.createMany({
              data: dto.benefits.map((b, idx) => ({
                serviceId: id,
                title: b.title,
                description: b.description,
                icon: b.icon,
                imageUrl: b.imageUrl,
                displayOrder: b.displayOrder ?? idx + 1,
                isVisible: b.isVisible ?? true,
              })),
            });
          }
        }

        if (dto.processSteps) {
          await tx.serviceProcessStepItem.deleteMany({ where: { serviceId: id } });
          if (dto.processSteps.length > 0) {
            await tx.serviceProcessStepItem.createMany({
              data: dto.processSteps.map((p, idx) => ({
                serviceId: id,
                stepNumber: p.stepNumber ?? idx + 1,
                title: p.title,
                description: p.description,
                icon: p.icon,
                displayOrder: p.displayOrder ?? idx + 1,
              })),
            });
          }
        }

        if (dto.mediaGallery) {
          await tx.serviceMediaItem.deleteMany({ where: { serviceId: id } });
          if (dto.mediaGallery.length > 0) {
            await tx.serviceMediaItem.createMany({
              data: dto.mediaGallery.map((m, idx) => ({
                serviceId: id,
                url: m.url,
                videoUrl: m.videoUrl,
                mediaType: m.mediaType || 'SCREENSHOT',
                title: m.title,
                caption: m.caption,
                altText: m.altText || m.title || 'Service preview screenshot',
                description: m.description,
                isCover: m.isCover ?? idx === 0,
                isPrimary: m.isPrimary ?? idx === 0,
                displayOrder: m.displayOrder ?? idx + 1,
              })),
            });
          }
        }

        if (dto.serviceFaqs) {
          await tx.serviceFaqItem.deleteMany({ where: { serviceId: id } });
          if (dto.serviceFaqs.length > 0) {
            await tx.serviceFaqItem.createMany({
              data: dto.serviceFaqs.map((faq, idx) => ({
                serviceId: id,
                question: faq.question,
                answer: faq.answer,
                displayOrder: faq.displayOrder ?? idx + 1,
                isVisible: faq.isVisible ?? true,
              })),
            });
          }
        }

        // Upsert legacy translation
        await tx.serviceTranslation.upsert({
          where: { serviceId_locale: { serviceId: id, locale: 'en' } },
          update: {
            name: title || existing.slug,
            summary: shortDesc || '',
            body: asJson({ fullDescription: fullDesc }),
            status: (dto.status as ContentStatus) || existing.status,
            publishedAt: dto.status === ContentStatus.PUBLISHED ? new Date() : undefined,
            seoTitle: dto.seoTitle,
            seoDescription: dto.metaDescription || dto.seoDescription,
          },
          create: {
            serviceId: id,
            locale: 'en',
            name: title || existing.slug,
            summary: shortDesc || '',
            body: asJson({ fullDescription: fullDesc }),
            status: (dto.status as ContentStatus) || existing.status,
            publishedAt: dto.status === ContentStatus.PUBLISHED ? new Date() : null,
            seoTitle: dto.seoTitle,
            seoDescription: dto.metaDescription || dto.seoDescription,
          },
        });

        if (dto.translations && dto.translations.length > 0) {
          for (const t of dto.translations) {
            await tx.serviceTranslation.upsert({
              where: { serviceId_locale: { serviceId: id, locale: t.locale } },
              update: {
                name: t.name,
                summary: t.summary,
                body: t.body ? asJson(t.body) : undefined,
                status:
                  (t.status as ContentStatus) || (dto.status as ContentStatus) || existing.status,
                publishedAt: t.status === ContentStatus.PUBLISHED ? new Date() : undefined,
                seoTitle: t.seoTitle,
                seoDescription: t.seoDescription,
              },
              create: {
                serviceId: id,
                locale: t.locale,
                name: t.name || title || existing.slug,
                summary: t.summary || shortDesc || '',
                body: t.body ? asJson(t.body) : asJson({ fullDescription: fullDesc }),
                status:
                  (t.status as ContentStatus) || (dto.status as ContentStatus) || existing.status,
                publishedAt: t.status === ContentStatus.PUBLISHED ? new Date() : null,
                seoTitle: t.seoTitle,
                seoDescription: t.seoDescription,
              },
            });
          }
        }
      });

      await this.audit(actor, 'service.update', id, { slug: existing.slug });
      return this.getAdmin(id);
    } catch (err) {
      this.rethrow(err);
    }
  }

  /**
   * Independent Per-Tab Section Save (Architectural Adjustment 2)
   */
  async updateSection(
    id: string,
    section: ServiceSection,
    data: ServiceSectionPayload,
    _actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service not found');

    try {
      await this.prisma.$transaction(async (tx) => {
        switch (section) {
          case 'basic': {
            await tx.service.update({
              where: { id },
              data: {
                title: data.title || data.name,
                name: data.name || data.title,
                slug: data.slug,
                tagline: data.tagline,
                shortDescription: data.shortDescription,
                description: data.fullDescription || data.description,
                fullDescription: data.fullDescription || data.description,
                targetAudience: data.targetAudience,
                problemSolved: data.problemSolved || data.problemsAddressed,
                problemsAddressed: data.problemsAddressed || data.problemSolved,
                ourApproachSummary: data.ourApproachSummary || data.approach,
                approach: data.approach || data.ourApproachSummary,
                serviceType: data.serviceType,
                brandColor: data.brandColor,
                coverImage: data.coverImage || data.coverImageUrl,
                coverImageUrl: data.coverImageUrl || data.coverImage,
                thumbnailImage: data.thumbnailImage || data.thumbnailUrl,
                thumbnailUrl: data.thumbnailUrl || data.thumbnailImage,
                icon: data.icon,
                categoryId: data.categoryId,
              },
            });
            break;
          }

          case 'offerings': {
            const items = Array.isArray(data.offerings) ? data.offerings : [];
            await tx.serviceOfferingItem.deleteMany({ where: { serviceId: id } });
            if (items.length > 0) {
              await tx.serviceOfferingItem.createMany({
                data: items.map((off, idx: number) => ({
                  serviceId: id,
                  title: off.title,
                  shortDescription: off.shortDescription,
                  detailedDescription: off.detailedDescription,
                  icon: off.icon,
                  imageUrl: off.imageUrl,
                  displayOrder: off.displayOrder ?? idx + 1,
                  isVisible: off.isVisible ?? true,
                })),
              });
            }
            break;
          }

          case 'benefits': {
            const items = Array.isArray(data.benefits) ? data.benefits : [];
            await tx.serviceBenefitItem.deleteMany({ where: { serviceId: id } });
            if (items.length > 0) {
              await tx.serviceBenefitItem.createMany({
                data: items.map((b, idx: number) => ({
                  serviceId: id,
                  title: b.title,
                  description: b.description,
                  icon: b.icon,
                  imageUrl: b.imageUrl,
                  displayOrder: b.displayOrder ?? idx + 1,
                  isVisible: b.isVisible ?? true,
                })),
              });
            }
            break;
          }

          case 'process': {
            const items = Array.isArray(data.processSteps) ? data.processSteps : [];
            await tx.serviceProcessStepItem.deleteMany({ where: { serviceId: id } });
            if (items.length > 0) {
              await tx.serviceProcessStepItem.createMany({
                data: items.map((p, idx: number) => ({
                  serviceId: id,
                  stepNumber: p.stepNumber ?? idx + 1,
                  title: p.title,
                  description: p.description,
                  icon: p.icon,
                  displayOrder: p.displayOrder ?? idx + 1,
                })),
              });
            }
            break;
          }

          case 'media': {
            const items = Array.isArray(data.mediaGallery) ? data.mediaGallery : [];
            await tx.serviceMediaItem.deleteMany({ where: { serviceId: id } });
            if (items.length > 0) {
              await tx.serviceMediaItem.createMany({
                data: items.map((m, idx: number) => ({
                  serviceId: id,
                  url: m.url,
                  videoUrl: m.videoUrl,
                  mediaType: m.mediaType || 'SCREENSHOT',
                  title: m.title,
                  caption: m.caption,
                  altText: m.altText || m.title || 'Screenshot',
                  description: m.description,
                  isCover: m.isCover ?? idx === 0,
                  isPrimary: m.isPrimary ?? idx === 0,
                  displayOrder: m.displayOrder ?? idx + 1,
                })),
              });
            }
            break;
          }

          case 'faqs': {
            const items = Array.isArray(data.serviceFaqs) ? data.serviceFaqs : [];
            await tx.serviceFaqItem.deleteMany({ where: { serviceId: id } });
            if (items.length > 0) {
              await tx.serviceFaqItem.createMany({
                data: items.map((faq, idx: number) => ({
                  serviceId: id,
                  question: faq.question,
                  answer: faq.answer,
                  displayOrder: faq.displayOrder ?? idx + 1,
                  isVisible: faq.isVisible ?? true,
                })),
              });
            }
            break;
          }

          case 'visibility': {
            await tx.service.update({
              where: { id },
              data: {
                status: data.status,
                isFeatured: data.isFeatured,
                showOnServicesPage: data.showOnServicesPage,
                showOnHomepage: data.showOnHomepage,
                showInNavbar: data.showInNavbar,
                showInNavDropdown: data.showInNavDropdown ?? data.showInNavbar,
                allowPublicDetail: data.allowPublicDetail,
                servicesPageOrder: data.servicesPageOrder,
                homepageOrder: data.homepageOrder,
                navbarOrder: data.navbarOrder,
                featuredOrder: data.featuredOrder,
                primaryCtaLabel: data.primaryCtaLabel,
                secondaryCtaLabel: data.secondaryCtaLabel,
              },
            });
            break;
          }

          case 'seo': {
            await tx.service.update({
              where: { id },
              data: {
                seoTitle: data.seoTitle,
                metaDescription: data.metaDescription || data.seoDescription,
                seoDescription: data.seoDescription || data.metaDescription,
                seoKeywords: data.seoKeywords,
                keywords: data.keywords,
                canonicalUrl: data.canonicalUrl,
                ogTitle: data.ogTitle,
                ogDescription: data.ogDescription,
                ogImage: data.ogImage,
                twitterImage: data.twitterImage,
                noIndex: data.noIndex,
                includeInSitemap: data.includeInSitemap,
              },
            });
            break;
          }
        }
      });

      return this.getAdmin(id);
    } catch (err) {
      this.rethrow(err);
    }
  }

  async reorder(dto: ReorderServicesDto, _actor: AuthenticatedUser) {
    const { placement, items } = dto;
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.service.update({
          where: { id: item.id },
          data: { [placement]: item.order },
        }),
      ),
    );

    return { success: true, count: items.length };
  }

  async duplicate(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.service.findUnique({
      where: { id },
      include: {
        offerings: true,
        benefits: true,
        processSteps: true,
        mediaGallery: true,
        serviceFaqs: true,
      },
    });

    if (!existing) throw new NotFoundException('Service not found');

    const newSlug = `${existing.slug}-copy-${Date.now().toString().slice(-4)}`;
    const newTitle = `${existing.title || existing.name} (Copy)`;

    const duplicated = await this.prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          slug: newSlug,
          title: newTitle,
          name: newTitle,
          tagline: existing.tagline,
          shortDescription: existing.shortDescription,
          description: existing.description,
          fullDescription: existing.fullDescription,
          problemSolved: existing.problemSolved,
          problemsAddressed: existing.problemsAddressed,
          targetAudience: existing.targetAudience,
          ourApproachSummary: existing.ourApproachSummary,
          approach: existing.approach,
          serviceType: existing.serviceType,
          brandColor: existing.brandColor,
          icon: existing.icon,
          coverImage: existing.coverImage,
          coverImageUrl: existing.coverImageUrl,
          thumbnailImage: existing.thumbnailImage,
          thumbnailUrl: existing.thumbnailUrl,
          status: ContentStatus.DRAFT,
          isFeatured: false,
          showOnServicesPage: false,
          showOnHomepage: false,
          showInNavbar: false,
          showInNavDropdown: false,
          allowPublicDetail: true,
          servicesPageOrder: existing.servicesPageOrder + 1,
          homepageOrder: existing.homepageOrder + 1,
          navbarOrder: existing.navbarOrder + 1,
          featuredOrder: 0,
          categoryId: existing.categoryId,
          seoTitle: `${newTitle} | MRM InfoTech`,
          metaDescription: existing.metaDescription,
          seoDescription: existing.seoDescription,
        },
      });

      if (existing.offerings.length > 0) {
        await tx.serviceOfferingItem.createMany({
          data: existing.offerings.map(({ id: _id, serviceId: _serviceId, ...rest }) => ({
            ...rest,
            serviceId: created.id,
          })),
        });
      }

      if (existing.benefits.length > 0) {
        await tx.serviceBenefitItem.createMany({
          data: existing.benefits.map(({ id: _id, serviceId: _serviceId, ...rest }) => ({
            ...rest,
            serviceId: created.id,
          })),
        });
      }

      if (existing.processSteps.length > 0) {
        await tx.serviceProcessStepItem.createMany({
          data: existing.processSteps.map(({ id: _id, serviceId: _serviceId, ...rest }) => ({
            ...rest,
            serviceId: created.id,
          })),
        });
      }

      if (existing.mediaGallery.length > 0) {
        await tx.serviceMediaItem.createMany({
          data: existing.mediaGallery.map(({ id: _id, serviceId: _serviceId, createdAt: _createdAt, ...rest }) => ({
            ...rest,
            serviceId: created.id,
          })),
        });
      }

      if (existing.serviceFaqs.length > 0) {
        await tx.serviceFaqItem.createMany({
          data: existing.serviceFaqs.map(({ id: _id, serviceId: _serviceId, ...rest }) => ({
            ...rest,
            serviceId: created.id,
          })),
        });
      }

      return created;
    });

    await this.audit(actor, 'service.duplicate', duplicated.id, { originalId: id });
    return this.getAdmin(duplicated.id);
  }

  async updateStatus(id: string, body: { status: ContentStatus }, actor: AuthenticatedUser) {
    if (body.status === ContentStatus.PUBLISHED) {
      this.requirePublish(actor);
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: { status: body.status },
    });

    await this.audit(actor, 'service.status', id, { status: body.status });
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const found = await this.prisma.service.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!found) throw new NotFoundException('Service not found');

    const [leads, caseStudies] = await Promise.all([
      this.prisma.lead.count({ where: { serviceId: id } }),
      this.prisma.caseStudy.count({ where: { serviceId: id } }),
    ]);

    if (leads > 0 || caseStudies > 0) {
      throw new ConflictException(
        'This service is referenced by leads or case studies. Set status to ARCHIVED or showOnServicesPage to false instead of deleting it.',
      );
    }

    try {
      await this.prisma.service.delete({ where: { id } });
    } catch (err) {
      this.rethrow(err);
    }

    await this.audit(actor, 'service.delete', id, { slug: found.slug });
  }

  // ───────────────────────── Category Management ─────────────────────────

  async getCategoriesAdmin() {
    return this.prisma.serviceCategory.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { services: true } },
      },
    });
  }

  async createCategory(data: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    displayOrder?: number;
  }) {
    return this.prisma.serviceCategory.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        icon: data.icon || 'Layers',
        displayOrder: data.displayOrder ?? 0,
        isActive: true,
      },
    });
  }

  async updateCategory(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string;
      icon: string;
      displayOrder: number;
      isActive: boolean;
    }>,
  ) {
    return this.prisma.serviceCategory.update({
      where: { id },
      data,
    });
  }

  async deleteCategory(id: string) {
    const count = await this.prisma.service.count({ where: { categoryId: id } });
    if (count > 0) {
      throw new ConflictException(`Cannot delete category with ${count} attached services.`);
    }
    return this.prisma.serviceCategory.delete({ where: { id } });
  }

  // ───────────────────────── Object Mapping Helpers ─────────────────────────

  private toPublicSummary(s: ServiceRow) {
    const title = s.title || s.name || s.slug;
    const shortDesc = s.shortDescription || s.description || '';
    return {
      id: s.id,
      slug: s.slug,
      title,
      name: title,
      tagline: s.tagline || '',
      shortDescription: shortDesc,
      summary: shortDesc,
      icon: s.icon || 'Code2',
      coverImage: s.coverImage || s.coverImageUrl || null,
      coverImageUrl: s.coverImageUrl || s.coverImage || null,
      thumbnailImage: s.thumbnailImage || s.thumbnailUrl || null,
      thumbnailUrl: s.thumbnailUrl || s.thumbnailImage || null,
      serviceType: s.serviceType || 'Custom Engineering',
      brandColor: s.brandColor || '#2563EB',
      isFeatured: s.isFeatured ?? false,
      servicesPageOrder: s.servicesPageOrder ?? s.sortOrder ?? 0,
      homepageOrder: s.homepageOrder ?? 0,
      navbarOrder: s.navbarOrder ?? 0,
      category: s.category
        ? { id: s.category.id, name: s.category.name, slug: s.category.slug }
        : null,
      categoryName: s.category?.name || 'Custom Engineering',
      offerings: (s.offerings || []).map((off) => ({
        id: off.id,
        title: off.title,
        shortDescription: off.shortDescription,
        detailedDescription: off.detailedDescription,
        icon: off.icon,
        imageUrl: off.imageUrl,
        displayOrder: off.displayOrder,
      })),
      technologies: (s.technologies || []).map((t) => ({
        id: t.technology?.id,
        name: t.technology?.name,
        slug: t.technology?.slug,
        category: t.technology?.category,
      })),
    };
  }

  private toPublicDetail(s: ServiceRow, related: RelatedServiceRow[]) {
    const title = s.title || s.name || s.slug;
    const shortDesc = s.shortDescription || s.description || '';
    const fullDesc = s.fullDescription || s.description || shortDesc;

    return {
      id: s.id,
      slug: s.slug,
      title,
      name: title,
      tagline: s.tagline || '',
      shortDescription: shortDesc,
      description: fullDesc,
      fullDescription: fullDesc,
      problemSolved: s.problemSolved || s.problemsAddressed || '',
      problemsAddressed: s.problemsAddressed || s.problemSolved || '',
      targetAudience: s.targetAudience || '',
      ourApproachSummary: s.ourApproachSummary || s.approach || '',
      approach: s.approach || s.ourApproachSummary || '',
      serviceType: s.serviceType || 'Custom Engineering',
      brandColor: s.brandColor || '#2563EB',
      icon: s.icon || 'Code2',
      coverImage: s.coverImage || s.coverImageUrl || null,
      coverImageUrl: s.coverImageUrl || s.coverImage || null,
      thumbnailImage: s.thumbnailImage || s.thumbnailUrl || null,
      thumbnailUrl: s.thumbnailUrl || s.thumbnailImage || null,
      isFeatured: s.isFeatured ?? false,
      primaryCtaLabel: s.primaryCtaLabel || 'Start a Project',
      secondaryCtaLabel: s.secondaryCtaLabel || 'Request a Consultation',
      category: s.category,
      categoryName: s.category?.name || 'Custom Engineering',
      offerings: s.offerings || [],
      benefits: s.benefits || [],
      processSteps: s.processSteps || [],
      mediaGallery: s.mediaGallery || [],
      serviceFaqs: s.serviceFaqs || [],
      technologies: (s.technologies || []).map((t) => ({
        id: t.technology?.id,
        name: t.technology?.name,
        slug: t.technology?.slug,
        category: t.technology?.category,
      })),
      caseStudies: s.caseStudies || [],
      relatedServices: related,
      availableLocales: ['en', 'bn'],
      seo: {
        seoTitle: s.seoTitle || `${title} | MRM InfoTech`,
        seoDescription: s.metaDescription || s.seoDescription || shortDesc,
        metaDescription: s.metaDescription || s.seoDescription || shortDesc,
        keywords: s.keywords || [],
        canonicalUrl: s.canonicalUrl || `https://mrminfotech.com/services/${s.slug}`,
        ogTitle: s.ogTitle || title,
        ogDescription: s.ogDescription || shortDesc,
        ogImage: s.ogImage || s.coverImageUrl || s.coverImage || '/logo.png',
        twitterImage: s.twitterImage || s.ogImage,
        noIndex: s.noIndex ?? false,
      },
    };
  }

  private toAdminSummary(s: ServiceRow) {
    const title = s.title || s.name || s.slug;
    return {
      id: s.id,
      slug: s.slug,
      title,
      name: title,
      tagline: s.tagline,
      shortDescription: s.shortDescription,
      status: s.status,
      isFeatured: s.isFeatured,
      showOnServicesPage: s.showOnServicesPage,
      showOnHomepage: s.showOnHomepage,
      showInNavbar: s.showInNavbar,
      showInNavDropdown: s.showInNavDropdown,
      allowPublicDetail: s.allowPublicDetail,
      servicesPageOrder: s.servicesPageOrder,
      homepageOrder: s.homepageOrder,
      navbarOrder: s.navbarOrder,
      featuredOrder: s.featuredOrder,
      sortOrder: s.sortOrder,
      icon: s.icon,
      coverImage: s.coverImage || s.coverImageUrl,
      category: s.category,
      categoryName: s.category?.name,
      offeringsCount: s.offerings?.length || 0,
      benefitsCount: s.benefits?.length || 0,
      stepsCount: s.processSteps?.length || 0,
      mediaCount: s.mediaGallery?.length || 0,
      faqsCount: s.serviceFaqs?.length || 0,
      leadsCount: s._count?.leads || 0,
      caseStudiesCount: s._count?.caseStudies || 0,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    };
  }

  private toAdminDetail(s: ServiceRow) {
    const title = s.title || s.name || s.slug;
    return {
      id: s.id,
      slug: s.slug,
      title,
      name: title,
      tagline: s.tagline || '',
      shortDescription: s.shortDescription || '',
      description: s.description || s.fullDescription || '',
      fullDescription: s.fullDescription || s.description || '',
      problemSolved: s.problemSolved || s.problemsAddressed || '',
      problemsAddressed: s.problemsAddressed || s.problemSolved || '',
      targetAudience: s.targetAudience || '',
      ourApproachSummary: s.ourApproachSummary || s.approach || '',
      approach: s.approach || s.ourApproachSummary || '',
      serviceType: s.serviceType || 'Custom Engineering',
      brandColor: s.brandColor || '#2563EB',
      coverImage: s.coverImage || s.coverImageUrl || '',
      coverImageUrl: s.coverImageUrl || s.coverImage || '',
      thumbnailImage: s.thumbnailImage || s.thumbnailUrl || '',
      thumbnailUrl: s.thumbnailUrl || s.thumbnailImage || '',
      icon: s.icon || 'Code2',
      status: s.status,
      isFeatured: s.isFeatured ?? false,
      showOnServicesPage: s.showOnServicesPage ?? true,
      showOnHomepage: s.showOnHomepage ?? false,
      showInNavbar: s.showInNavbar ?? true,
      showInNavDropdown: s.showInNavDropdown ?? s.showInNavbar ?? true,
      allowPublicDetail: s.allowPublicDetail ?? true,
      servicesPageOrder: s.servicesPageOrder ?? 0,
      homepageOrder: s.homepageOrder ?? 0,
      navbarOrder: s.navbarOrder ?? 0,
      featuredOrder: s.featuredOrder ?? 0,
      sortOrder: s.sortOrder ?? s.servicesPageOrder ?? 0,
      primaryCtaLabel: s.primaryCtaLabel || 'Start a Project',
      secondaryCtaLabel: s.secondaryCtaLabel || 'Request a Consultation',
      seoTitle: s.seoTitle || '',
      metaDescription: s.metaDescription || s.seoDescription || '',
      seoDescription: s.seoDescription || s.metaDescription || '',
      seoKeywords: s.seoKeywords || '',
      keywords: s.keywords || [],
      canonicalUrl: s.canonicalUrl || '',
      ogTitle: s.ogTitle || '',
      ogDescription: s.ogDescription || '',
      ogImage: s.ogImage || '',
      twitterImage: s.twitterImage || '',
      noIndex: s.noIndex ?? false,
      includeInSitemap: s.includeInSitemap ?? true,
      categoryId: s.categoryId || undefined,
      category: s.category,
      categoryName: s.category?.name,
      offerings: s.offerings || [],
      benefits: s.benefits || [],
      processSteps: s.processSteps || [],
      mediaGallery: s.mediaGallery || [],
      serviceFaqs: s.serviceFaqs || [],
      technologies: s.technologies || [],
      caseStudies: s.caseStudies || [],
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    };
  }

  private assertUnique(locales: string[]): void {
    if (new Set(locales).size !== locales.length) {
      throw new BadRequestException('Each locale may appear only once');
    }
  }

  private async assertLocalesEnabled(locales: string[]): Promise<void> {
    if (!locales.length) return;
    const rows = await this.prisma.language.findMany({
      where: { code: { in: locales }, isEnabled: true },
      select: { code: true },
    });
    const ok = new Set(rows.map((r) => r.code));
    const bad = locales.filter((l) => !ok.has(l));
    if (bad.length) {
      throw new BadRequestException(`Unknown or disabled locale: ${bad.join(', ')}`);
    }
  }

  private requirePublish(actor: AuthenticatedUser): void {
    if (!actor.permissions.includes(SERVICE_PERMISSIONS.publish)) {
      throw new ForbiddenException('Publishing a service requires service:publish permission');
    }
  }

  private rethrow(err: unknown): never {
    switch (prismaCode(err)) {
      case 'P2002':
        throw new ConflictException('A service with this URL slug already exists');
      case 'P2025':
        throw new NotFoundException('Service not found');
      case 'P2003':
        throw new ConflictException('The service is referenced by other database records');
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
        data: { actorId: actor.id, action, entityType: 'service', entityId, diff: diff as never },
      });
    } catch (err) {
      this.logger.error(`Audit log failed for ${action}: ${(err as Error).message}`);
    }
  }
}
