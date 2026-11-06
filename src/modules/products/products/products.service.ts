import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, LaunchStage, Prisma } from '@prisma/client';
import type { Product, ProductTranslation } from '@prisma/client';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../../../database/prisma.service';
import { CreateProductDto, ProductTranslationDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdminQueryProductDto, QueryProductDto } from './dto/query-product.dto';
import { ReorderProductsDto } from './dto/reorder-products.dto';
import { ProductSection } from './dto/update-product-section.dto';

const PUBLISH_PERMISSION = 'product:publish';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** List active product categories for public and admin navigation */
  async listCategories() {
    return this.prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /** Public listing with multi-placement and category support */
  async listPublic(query: QueryProductDto) {
    const locales = await this.publicLocales(query.locale);
    const now = new Date();

    const where: Prisma.ProductWhereInput = {
      ...(query.placement === 'homepage'
        ? {
            status: ContentStatus.PUBLISHED,
            showOnHomepage: true,
          }
        : query.placement === 'nav'
        ? {
            status: { in: [ContentStatus.PUBLISHED, ContentStatus.DRAFT] },
            showInNavDropdown: true,
          }
        : query.placement === 'catalog'
        ? {
            status: { in: [ContentStatus.PUBLISHED, ContentStatus.DRAFT] },
            showOnProductsPage: true,
          }
        : {
            status: ContentStatus.PUBLISHED,
          }),
      ...(query.category
        ? {
            OR: [
              { category: { slug: query.category } },
              { categoryId: query.category },
            ],
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { tagline: { contains: query.search, mode: 'insensitive' } },
              {
                translations: {
                  some: {
                    OR: [
                      { name: { contains: query.search, mode: 'insensitive' } },
                      { summary: { contains: query.search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    // Determine sorting based on placement
    let orderBy: Prisma.ProductOrderByWithRelationInput = { displayOrder: query.order };
    if (query.placement === 'homepage') {
      orderBy = { homepageOrder: 'asc' };
    } else if (query.placement === 'nav') {
      orderBy = { navOrder: 'asc' };
    } else if (query.sortBy) {
      orderBy = { [query.sortBy]: query.order };
    }

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          mediaItems: { orderBy: { displayOrder: 'asc' } },
          richFeatures: { orderBy: { displayOrder: 'asc' } },
          benefits: { orderBy: { displayOrder: 'asc' } },
          links: { where: { isVisible: true }, orderBy: { displayOrder: 'asc' } },
          translations: {
            where: {
              locale: { in: locales },
              status: ContentStatus.PUBLISHED,
              publishedAt: { lte: now },
            },
          },
        },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return this.result(
      products.map((product) => this.publicProduct(product, locales)),
      total,
      query,
    );
  }

  /** Public or preview product detail by slug */
  async findPublicBySlug(slug: string, locale = 'en', preview = false) {
    const locales = await this.publicLocales(locale);

    const where: Prisma.ProductWhereInput = preview
      ? { slug }
      : {
          slug,
          allowPublicDetail: true,
          status: ContentStatus.PUBLISHED,
        };

    const product = await this.prisma.product.findFirst({
      where,
      include: {
        category: true,
        mediaItems: { orderBy: { displayOrder: 'asc' } },
        richFeatures: { orderBy: { displayOrder: 'asc' } },
        benefits: { orderBy: { displayOrder: 'asc' } },
        links: {
          where: preview ? undefined : { isVisible: true },
          orderBy: { displayOrder: 'asc' },
        },
        demonstrations: { orderBy: { displayOrder: 'asc' } },
        productFaqs: { orderBy: { displayOrder: 'asc' } },
        caseStudies: {
          where: { isVerified: true, publishedAt: { not: null } },
          select: {
            id: true,
            slug: true,
            isFeatured: true,
            projectWorkStatus: true,
            metrics: true,
            translations: { where: { locale: { in: locales } } },
          },
        },
        translations: {
          where: { locale: { in: locales } },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    return this.publicProductDetail(product, locales);
  }

  /** Admin listing with KPI metrics and detailed counts */
  async listAdmin(query: AdminQueryProductDto) {
    const where: Prisma.ProductWhereInput = {
      AND: [
        ...(query.search
          ? [
              {
                OR: [
                  { title: { contains: query.search, mode: 'insensitive' as const } },
                  { slug: { contains: query.search, mode: 'insensitive' as const } },
                  { description: { contains: query.search, mode: 'insensitive' as const } },
                  {
                    translations: {
                      some: {
                        OR: [
                          { name: { contains: query.search, mode: 'insensitive' as const } },
                          { summary: { contains: query.search, mode: 'insensitive' as const } },
                        ],
                      },
                    },
                  },
                ],
              },
            ]
          : []),
        ...(query.status
          ? [{ status: query.status as ContentStatus }]
          : []),
        ...(query.stage
          ? [{ stage: query.stage as LaunchStage }]
          : []),
        ...(query.category
          ? [
              {
                OR: [
                  { category: { slug: query.category } },
                  { categoryId: query.category },
                ],
              },
            ]
          : []),
      ],
    };

    // Calculate live KPI metrics in parallel
    const [
      items,
      total,
      totalPublished,
      totalDraft,
      totalFeatured,
      totalComingSoon,
      totalArchived,
    ] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          translations: true,
          _count: {
            select: {
              mediaItems: true,
              richFeatures: true,
              benefits: true,
              links: true,
              demonstrations: true,
              productFaqs: true,
              caseStudies: true,
            },
          },
        },
        orderBy: { [query.sortBy || 'displayOrder']: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
      this.prisma.product.count({ where: { status: ContentStatus.PUBLISHED } }),
      this.prisma.product.count({ where: { status: ContentStatus.DRAFT } }),
      this.prisma.product.count({ where: { isFeatured: true } }),
      this.prisma.product.count({
        where: {
          OR: [
            { stage: LaunchStage.COMING_SOON },
            { stage: LaunchStage.PLANNED },
          ],
        },
      }),
      this.prisma.product.count({ where: { status: ContentStatus.ARCHIVED } }),
    ]);

    return {
      data: items.map((product) => this.toAdmin(product)),
      kpi: {
        total: totalPublished + totalDraft + totalArchived,
        published: totalPublished,
        draft: totalDraft,
        featured: totalFeatured,
        comingSoon: totalComingSoon,
        archived: totalArchived,
      },
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /** Find one complete product for admin inspection/editing */
  async findOneAdmin(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        mediaItems: { orderBy: { displayOrder: 'asc' } },
        richFeatures: { orderBy: { displayOrder: 'asc' } },
        benefits: { orderBy: { displayOrder: 'asc' } },
        links: { orderBy: { displayOrder: 'asc' } },
        demonstrations: { orderBy: { displayOrder: 'asc' } },
        productFaqs: { orderBy: { displayOrder: 'asc' } },
        caseStudies: {
          select: {
            id: true,
            slug: true,
            isFeatured: true,
            projectWorkStatus: true,
            metrics: true,
          },
        },
        translations: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.toAdminDetail(product);
  }

  /** Create new product (supports quick creation with just title/slug) */
  async create(dto: CreateProductDto, actor: AuthenticatedUser) {
    const hasExplicitTranslations = Boolean(dto.translations && dto.translations.length > 0);
    const translations = hasExplicitTranslations
      ? await this.translationsData(dto.translations!, actor)
      : [
          {
            locale: 'en',
            name: dto.title || dto.slug,
            tagline: dto.tagline || '',
            summary: dto.shortDescription || dto.description || dto.tagline || dto.title || dto.slug,
            body: {} as Prisma.InputJsonValue,
            status: dto.status ?? ContentStatus.DRAFT,
            publishedAt: dto.status === ContentStatus.PUBLISHED ? new Date() : null,
            ogImageId: undefined,
            seoTitle: dto.seoTitle || dto.title || dto.slug,
            seoDescription: dto.seoDescription || dto.shortDescription || dto.description,
            noIndex: dto.noIndex ?? false,
          },
        ];

    // Compute synced images array from mediaItems if provided
    const mediaUrls = dto.mediaItems ? dto.mediaItems.map((m) => m.url) : [];
    const images = dto.images && dto.images.length > 0 ? dto.images : mediaUrls;

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            slug: dto.slug,
            stage: dto.stage ?? LaunchStage.LIVE,
            status: dto.status ?? ContentStatus.PUBLISHED,
            title: dto.title || dto.slug,
            tagline: dto.tagline,
            shortDescription: dto.shortDescription,
            description: dto.description,
            targetAudience: dto.targetAudience,
            problemsAddressed: dto.problemsAddressed,
            mainPurpose: dto.mainPurpose,
            productType: dto.productType ?? 'SaaS',
            version: dto.version,
            categoryId: dto.categoryId,
            logoUrl: dto.logoUrl,
            thumbnailUrl: dto.thumbnailUrl,
            images,
            liveUrl: dto.liveUrl,
            caseStudy: dto.caseStudy,
            sourceCodeUrl: dto.sourceCodeUrl,
            isSourcePrivate: dto.isSourcePrivate ?? false,
            logoId: dto.logoId,
            heroImageId: dto.heroImageId,
            brandColor: dto.brandColor,
            productSiteUrl: dto.productSiteUrl ?? dto.liveUrl,
            demoUrl: dto.demoUrl ?? dto.liveUrl,
            privacyUrl: dto.privacyUrl,
            termsUrl: dto.termsUrl,
            isFeatured: dto.isFeatured ?? false,
            showOnHomepage: dto.showOnHomepage ?? true,
            showOnProductsPage: dto.showOnProductsPage ?? true,
            showInNavDropdown: dto.showInNavDropdown ?? true,
            allowPublicDetail: dto.allowPublicDetail ?? true,
            enableGallery: dto.enableGallery ?? true,
            enableCaseStudies: dto.enableCaseStudies ?? true,
            enableDemos: dto.enableDemos ?? true,
            enableFaq: dto.enableFaq ?? true,
            sortOrder: dto.sortOrder ?? 0,
            displayOrder: dto.displayOrder ?? 0,
            homepageOrder: dto.homepageOrder ?? 0,
            navOrder: dto.navOrder ?? 0,
            featuredOrder: dto.featuredOrder ?? 0,
            seoTitle: dto.seoTitle,
            seoDescription: dto.seoDescription,
            seoKeywords: dto.seoKeywords,
            canonicalUrl: dto.canonicalUrl,
            ogTitle: dto.ogTitle,
            ogDescription: dto.ogDescription,
            ogImage: dto.ogImage,
            twitterImage: dto.twitterImage,
            noIndex: dto.noIndex ?? false,
            includeInSitemap: dto.includeInSitemap ?? true,
            launchedAt: dto.launchedAt,
            translations: {
              create: translations.map(({ locale, ...data }) => ({
                ...data,
                language: { connect: { code: locale } },
              })),
            },
          },
        });

        // Insert sub-collections if provided
        if (dto.mediaItems && dto.mediaItems.length > 0) {
          await tx.productMediaItem.createMany({
            data: dto.mediaItems.map((m, idx) => ({
              productId: created.id,
              url: m.url,
              mediaType: m.mediaType ?? 'SCREENSHOT',
              title: m.title,
              caption: m.caption,
              altText: m.altText,
              description: m.description,
              isPrimary: m.isPrimary ?? idx === 0,
              displayOrder: m.displayOrder ?? idx + 1,
            })),
          });
        }

        if (dto.richFeatures && dto.richFeatures.length > 0) {
          await tx.productFeatureItem.createMany({
            data: dto.richFeatures.map((f, idx) => ({
              productId: created.id,
              title: f.title,
              shortDescription: f.shortDescription,
              detailedDescription: f.detailedDescription,
              icon: f.icon,
              imageUrl: f.imageUrl,
              categoryName: f.categoryName ?? 'Core Features',
              isFeatured: f.isFeatured ?? false,
              displayOrder: f.displayOrder ?? idx + 1,
            })),
          });
        }

        if (dto.benefits && dto.benefits.length > 0) {
          await tx.productBenefit.createMany({
            data: dto.benefits.map((b, idx) => ({
              productId: created.id,
              title: b.title,
              description: b.description,
              icon: b.icon,
              displayOrder: b.displayOrder ?? idx + 1,
            })),
          });
        }

        if (dto.links && dto.links.length > 0) {
          await tx.productLink.createMany({
            data: dto.links.map((l, idx) => ({
              productId: created.id,
              title: l.title,
              url: l.url,
              linkType: l.linkType ?? 'OFFICIAL_WEBSITE',
              icon: l.icon,
              openInNewTab: l.openInNewTab ?? true,
              isVisible: l.isVisible ?? true,
              displayOrder: l.displayOrder ?? idx + 1,
            })),
          });
        }

        if (dto.demonstrations && dto.demonstrations.length > 0) {
          await tx.productDemonstration.createMany({
            data: dto.demonstrations.map((d, idx) => ({
              productId: created.id,
              title: d.title,
              description: d.description,
              demoType: d.demoType ?? 'DASHBOARD',
              mediaUrl: d.mediaUrl,
              caption: d.caption,
              displayOrder: d.displayOrder ?? idx + 1,
            })),
          });
        }

        if (dto.productFaqs && dto.productFaqs.length > 0) {
          await tx.productFaqItem.createMany({
            data: dto.productFaqs.map((faq, idx) => ({
              productId: created.id,
              question: faq.question,
              answer: faq.answer,
              displayOrder: faq.displayOrder ?? idx + 1,
            })),
          });
        }

        return created;
      });

      return this.findOneAdmin(product.id);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  /** Update complete product */
  async update(id: string, dto: UpdateProductDto, actor: AuthenticatedUser) {
    const existing = await this.findOneAdmin(id);

    if (
      dto.status === ContentStatus.PUBLISHED &&
      existing.status !== ContentStatus.PUBLISHED &&
      !actor.permissions.includes(PUBLISH_PERMISSION)
    ) {
      throw new ForbiddenException('Publishing a product requires product:publish');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Compute synced images array
        let images = dto.images;
        if (dto.mediaItems) {
          images = dto.mediaItems.map((m) => m.url);
        }

        await tx.product.update({
          where: { id },
          data: {
            slug: dto.slug,
            stage: dto.stage,
            status: dto.status,
            title: dto.title,
            tagline: dto.tagline,
            shortDescription: dto.shortDescription,
            description: dto.description,
            targetAudience: dto.targetAudience,
            problemsAddressed: dto.problemsAddressed,
            mainPurpose: dto.mainPurpose,
            productType: dto.productType,
            version: dto.version,
            categoryId: dto.categoryId,
            logoUrl: dto.logoUrl,
            thumbnailUrl: dto.thumbnailUrl,
            images,
            liveUrl: dto.liveUrl,
            caseStudy: dto.caseStudy,
            sourceCodeUrl: dto.sourceCodeUrl,
            isSourcePrivate: dto.isSourcePrivate,
            brandColor: dto.brandColor,
            productSiteUrl: dto.productSiteUrl,
            demoUrl: dto.demoUrl,
            privacyUrl: dto.privacyUrl,
            termsUrl: dto.termsUrl,
            isFeatured: dto.isFeatured,
            showOnHomepage: dto.showOnHomepage,
            showOnProductsPage: dto.showOnProductsPage,
            showInNavDropdown: dto.showInNavDropdown,
            allowPublicDetail: dto.allowPublicDetail,
            enableGallery: dto.enableGallery,
            enableCaseStudies: dto.enableCaseStudies,
            enableDemos: dto.enableDemos,
            enableFaq: dto.enableFaq,
            sortOrder: dto.sortOrder,
            displayOrder: dto.displayOrder,
            homepageOrder: dto.homepageOrder,
            navOrder: dto.navOrder,
            featuredOrder: dto.featuredOrder,
            seoTitle: dto.seoTitle,
            seoDescription: dto.seoDescription,
            seoKeywords: dto.seoKeywords,
            canonicalUrl: dto.canonicalUrl,
            ogTitle: dto.ogTitle,
            ogDescription: dto.ogDescription,
            ogImage: dto.ogImage,
            twitterImage: dto.twitterImage,
            noIndex: dto.noIndex,
            includeInSitemap: dto.includeInSitemap,
            launchedAt: dto.launchedAt,
          },
        });

        // Sync Sub-collections if specified
        if (dto.mediaItems) {
          await tx.productMediaItem.deleteMany({ where: { productId: id } });
          if (dto.mediaItems.length > 0) {
            await tx.productMediaItem.createMany({
              data: dto.mediaItems.map((m, idx) => ({
                productId: id,
                url: m.url,
                mediaType: m.mediaType ?? 'SCREENSHOT',
                title: m.title,
                caption: m.caption,
                altText: m.altText,
                description: m.description,
                isPrimary: m.isPrimary ?? idx === 0,
                displayOrder: m.displayOrder ?? idx + 1,
              })),
            });
          }
        }

        if (dto.richFeatures) {
          await tx.productFeatureItem.deleteMany({ where: { productId: id } });
          if (dto.richFeatures.length > 0) {
            await tx.productFeatureItem.createMany({
              data: dto.richFeatures.map((f, idx) => ({
                productId: id,
                title: f.title,
                shortDescription: f.shortDescription,
                detailedDescription: f.detailedDescription,
                icon: f.icon,
                imageUrl: f.imageUrl,
                categoryName: f.categoryName ?? 'Core Features',
                isFeatured: f.isFeatured ?? false,
                displayOrder: f.displayOrder ?? idx + 1,
              })),
            });
          }
        }

        if (dto.benefits) {
          await tx.productBenefit.deleteMany({ where: { productId: id } });
          if (dto.benefits.length > 0) {
            await tx.productBenefit.createMany({
              data: dto.benefits.map((b, idx) => ({
                productId: id,
                title: b.title,
                description: b.description,
                icon: b.icon,
                displayOrder: b.displayOrder ?? idx + 1,
              })),
            });
          }
        }

        if (dto.links) {
          await tx.productLink.deleteMany({ where: { productId: id } });
          if (dto.links.length > 0) {
            await tx.productLink.createMany({
              data: dto.links.map((l, idx) => ({
                productId: id,
                title: l.title,
                url: l.url,
                linkType: l.linkType ?? 'OFFICIAL_WEBSITE',
                icon: l.icon,
                openInNewTab: l.openInNewTab ?? true,
                isVisible: l.isVisible ?? true,
                displayOrder: l.displayOrder ?? idx + 1,
              })),
            });
          }
        }

        if (dto.demonstrations) {
          await tx.productDemonstration.deleteMany({ where: { productId: id } });
          if (dto.demonstrations.length > 0) {
            await tx.productDemonstration.createMany({
              data: dto.demonstrations.map((d, idx) => ({
                productId: id,
                title: d.title,
                description: d.description,
                demoType: d.demoType ?? 'DASHBOARD',
                mediaUrl: d.mediaUrl,
                caption: d.caption,
                displayOrder: d.displayOrder ?? idx + 1,
              })),
            });
          }
        }

        if (dto.productFaqs) {
          await tx.productFaqItem.deleteMany({ where: { productId: id } });
          if (dto.productFaqs.length > 0) {
            await tx.productFaqItem.createMany({
              data: dto.productFaqs.map((faq, idx) => ({
                productId: id,
                question: faq.question,
                answer: faq.answer,
                displayOrder: faq.displayOrder ?? idx + 1,
              })),
            });
          }
        }
      });

      return this.findOneAdmin(id);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  /**
   * Architectural Adjustment 2: Independent Section / Tab Save
   * Validates and updates ONLY the requested tab without cross-tab conflicts.
   */
  async updateSection(
    id: string,
    section: ProductSection,
    data: Record<string, any>,
    actor: AuthenticatedUser,
  ) {
    await this.findOneAdmin(id);

    try {
      await this.prisma.$transaction(async (tx) => {
        switch (section) {
          case 'basic': {
            await tx.product.update({
              where: { id },
              data: {
                title: data.title,
                slug: data.slug,
                tagline: data.tagline,
                shortDescription: data.shortDescription,
                description: data.description,
                targetAudience: data.targetAudience,
                problemsAddressed: data.problemsAddressed,
                mainPurpose: data.mainPurpose,
                productType: data.productType,
                stage: data.stage,
                categoryId: data.categoryId,
                brandColor: data.brandColor,
                version: data.version,
                logoUrl: data.logoUrl,
                thumbnailUrl: data.thumbnailUrl,
                launchedAt: data.launchedAt ? new Date(data.launchedAt) : undefined,
              },
            });
            break;
          }

          case 'media': {
            const items = Array.isArray(data.mediaItems) ? data.mediaItems : [];
            await tx.productMediaItem.deleteMany({ where: { productId: id } });
            if (items.length > 0) {
              await tx.productMediaItem.createMany({
                data: items.map((m: any, idx: number) => ({
                  productId: id,
                  url: m.url,
                  mediaType: m.mediaType ?? 'SCREENSHOT',
                  title: m.title,
                  caption: m.caption,
                  altText: m.altText,
                  description: m.description,
                  isPrimary: m.isPrimary ?? idx === 0,
                  displayOrder: m.displayOrder ?? idx + 1,
                })),
              });
            }
            // Sync images array
            await tx.product.update({
              where: { id },
              data: { images: items.map((m: any) => m.url) },
            });
            break;
          }

          case 'features': {
            const items = Array.isArray(data.richFeatures) ? data.richFeatures : [];
            await tx.productFeatureItem.deleteMany({ where: { productId: id } });
            if (items.length > 0) {
              await tx.productFeatureItem.createMany({
                data: items.map((f: any, idx: number) => ({
                  productId: id,
                  title: f.title,
                  shortDescription: f.shortDescription,
                  detailedDescription: f.detailedDescription,
                  icon: f.icon,
                  imageUrl: f.imageUrl,
                  categoryName: f.categoryName ?? 'Core Features',
                  isFeatured: f.isFeatured ?? false,
                  displayOrder: f.displayOrder ?? idx + 1,
                })),
              });
            }
            break;
          }

          case 'benefits': {
            const items = Array.isArray(data.benefits) ? data.benefits : [];
            await tx.productBenefit.deleteMany({ where: { productId: id } });
            if (items.length > 0) {
              await tx.productBenefit.createMany({
                data: items.map((b: any, idx: number) => ({
                  productId: id,
                  title: b.title,
                  description: b.description,
                  icon: b.icon,
                  displayOrder: b.displayOrder ?? idx + 1,
                })),
              });
            }
            break;
          }

          case 'links': {
            const items = Array.isArray(data.links) ? data.links : [];
            await tx.productLink.deleteMany({ where: { productId: id } });
            if (items.length > 0) {
              await tx.productLink.createMany({
                data: items.map((l: any, idx: number) => ({
                  productId: id,
                  title: l.title,
                  url: l.url,
                  linkType: l.linkType ?? 'OFFICIAL_WEBSITE',
                  icon: l.icon,
                  openInNewTab: l.openInNewTab ?? true,
                  isVisible: l.isVisible ?? true,
                  displayOrder: l.displayOrder ?? idx + 1,
                })),
              });
            }
            break;
          }

          case 'demonstrations': {
            const items = Array.isArray(data.demonstrations) ? data.demonstrations : [];
            await tx.productDemonstration.deleteMany({ where: { productId: id } });
            if (items.length > 0) {
              await tx.productDemonstration.createMany({
                data: items.map((d: any, idx: number) => ({
                  productId: id,
                  title: d.title,
                  description: d.description,
                  demoType: d.demoType ?? 'DASHBOARD',
                  mediaUrl: d.mediaUrl,
                  caption: d.caption,
                  displayOrder: d.displayOrder ?? idx + 1,
                })),
              });
            }
            break;
          }

          case 'faqs': {
            const items = Array.isArray(data.productFaqs) ? data.productFaqs : [];
            await tx.productFaqItem.deleteMany({ where: { productId: id } });
            if (items.length > 0) {
              await tx.productFaqItem.createMany({
                data: items.map((faq: any, idx: number) => ({
                  productId: id,
                  question: faq.question,
                  answer: faq.answer,
                  displayOrder: faq.displayOrder ?? idx + 1,
                })),
              });
            }
            break;
          }

          case 'visibility': {
            if (
              data.status === ContentStatus.PUBLISHED &&
              !actor.permissions.includes(PUBLISH_PERMISSION)
            ) {
              throw new ForbiddenException('Publishing a product requires product:publish');
            }
            await tx.product.update({
              where: { id },
              data: {
                status: data.status,
                isFeatured: data.isFeatured,
                showOnHomepage: data.showOnHomepage,
                showOnProductsPage: data.showOnProductsPage,
                showInNavDropdown: data.showInNavDropdown,
                allowPublicDetail: data.allowPublicDetail,
                enableGallery: data.enableGallery,
                enableCaseStudies: data.enableCaseStudies,
                enableDemos: data.enableDemos,
                enableFaq: data.enableFaq,
                displayOrder: data.displayOrder,
                homepageOrder: data.homepageOrder,
                navOrder: data.navOrder,
                featuredOrder: data.featuredOrder,
              },
            });
            break;
          }

          case 'seo': {
            await tx.product.update({
              where: { id },
              data: {
                seoTitle: data.seoTitle,
                seoDescription: data.seoDescription,
                seoKeywords: data.seoKeywords,
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

          default:
            throw new BadRequestException(`Unknown product section: ${section}`);
        }
      });

      return this.findOneAdmin(id);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  /** Transactional multi-context reordering */
  async reorder(dto: ReorderProductsDto, actor: AuthenticatedUser) {
    if (!dto.items || dto.items.length === 0) {
      return { success: true, count: 0 };
    }

    const orderField = dto.context;

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.product.update({
          where: { id: item.id },
          data: {
            [orderField]: item.order,
            // also sync legacy sortOrder if displayOrder was touched
            ...(orderField === 'displayOrder' ? { sortOrder: item.order } : {}),
          },
        }),
      ),
    );

    return { success: true, count: dto.items.length };
  }

  /** Duplicate a product as a new DRAFT */
  async duplicate(id: string, actor: AuthenticatedUser) {
    const original = await this.findOneAdmin(id);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newSlug = `${original.slug}-copy-${randomSuffix}`;
    const newTitle = `${original.title} (Copy)`;

    const duplicated = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          slug: newSlug,
          title: newTitle,
          status: ContentStatus.DRAFT,
          stage: LaunchStage.BETA,
          tagline: original.tagline,
          shortDescription: original.shortDescription,
          description: original.description,
          targetAudience: original.targetAudience,
          problemsAddressed: original.problemsAddressed,
          mainPurpose: original.mainPurpose,
          productType: original.productType,
          version: original.version,
          categoryId: original.categoryId,
          brandColor: original.brandColor,
          logoUrl: original.logoUrl,
          thumbnailUrl: original.thumbnailUrl,
          images: original.images,
          liveUrl: original.liveUrl,
          caseStudy: original.caseStudy,
          sourceCodeUrl: original.sourceCodeUrl,
          isSourcePrivate: original.isSourcePrivate,
          isFeatured: false,
          showOnHomepage: false,
          showOnProductsPage: true,
          showInNavDropdown: false,
          allowPublicDetail: true,
          enableGallery: original.enableGallery,
          enableCaseStudies: original.enableCaseStudies,
          enableDemos: original.enableDemos,
          enableFaq: original.enableFaq,
          displayOrder: original.displayOrder + 10,
          homepageOrder: original.homepageOrder + 10,
          navOrder: original.navOrder + 10,
          seoTitle: original.seoTitle,
          seoDescription: original.seoDescription,
        },
      });

      if (original.mediaItems && original.mediaItems.length > 0) {
        await tx.productMediaItem.createMany({
          data: original.mediaItems.map((m: any) => ({
            productId: created.id,
            url: m.url,
            mediaType: m.mediaType,
            title: m.title,
            caption: m.caption,
            altText: m.altText,
            description: m.description,
            isPrimary: m.isPrimary,
            displayOrder: m.displayOrder,
          })),
        });
      }

      if (original.richFeatures && original.richFeatures.length > 0) {
        await tx.productFeatureItem.createMany({
          data: original.richFeatures.map((f: any) => ({
            productId: created.id,
            title: f.title,
            shortDescription: f.shortDescription,
            detailedDescription: f.detailedDescription,
            icon: f.icon,
            imageUrl: f.imageUrl,
            categoryName: f.categoryName,
            isFeatured: f.isFeatured,
            displayOrder: f.displayOrder,
          })),
        });
      }

      if (original.benefits && original.benefits.length > 0) {
        await tx.productBenefit.createMany({
          data: original.benefits.map((b: any) => ({
            productId: created.id,
            title: b.title,
            description: b.description,
            icon: b.icon,
            displayOrder: b.displayOrder,
          })),
        });
      }

      if (original.links && original.links.length > 0) {
        await tx.productLink.createMany({
          data: original.links.map((l: any) => ({
            productId: created.id,
            title: l.title,
            url: l.url,
            linkType: l.linkType,
            icon: l.icon,
            openInNewTab: l.openInNewTab,
            isVisible: l.isVisible,
            displayOrder: l.displayOrder,
          })),
        });
      }

      if (original.demonstrations && original.demonstrations.length > 0) {
        await tx.productDemonstration.createMany({
          data: original.demonstrations.map((d: any) => ({
            productId: created.id,
            title: d.title,
            description: d.description,
            demoType: d.demoType,
            mediaUrl: d.mediaUrl,
            caption: d.caption,
            displayOrder: d.displayOrder,
          })),
        });
      }

      if (original.productFaqs && original.productFaqs.length > 0) {
        await tx.productFaqItem.createMany({
          data: original.productFaqs.map((faq: any) => ({
            productId: created.id,
            question: faq.question,
            answer: faq.answer,
            displayOrder: faq.displayOrder,
          })),
        });
      }

      return created;
    });

    return this.findOneAdmin(duplicated.id);
  }

  /** Quick status / stage update */
  async updateStatus(
    id: string,
    body: { status: ContentStatus; stage?: LaunchStage },
    actor: AuthenticatedUser,
  ) {
    if (
      body.status === ContentStatus.PUBLISHED &&
      !actor.permissions.includes(PUBLISH_PERMISSION)
    ) {
      throw new ForbiddenException('Publishing a product requires product:publish');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.stage ? { stage: body.stage } : {}),
      },
    });

    return { success: true, status: updated.status, stage: updated.stage };
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    try {
      await this.prisma.product.delete({ where: { id } });
    } catch (error) {
      this.handleDbError(error);
    }
    return { message: 'Product deleted' };
  }

  private async translationsData(
    rows: ProductTranslationDto[],
    actor: AuthenticatedUser,
    existingRows?: Array<{ locale: string; status: ContentStatus; publishedAt: Date | null }>,
  ) {
    if (!rows.length || new Set(rows.map(({ locale }) => locale)).size !== rows.length) {
      throw new BadRequestException('At least one translation with a unique locale is required');
    }
    const languages = await this.prisma.language.findMany({
      where: { code: { in: rows.map(({ locale }) => locale) }, isEnabled: true },
      select: { code: true },
    });
    if (languages.length !== rows.length)
      throw new BadRequestException('Every translation locale must be enabled');
    return rows.map((row) => {
      const existing = existingRows?.find((translation) => translation.locale === row.locale);
      const status = row.status ?? existing?.status ?? ContentStatus.DRAFT;
      if (status === ContentStatus.PUBLISHED && !actor.permissions.includes(PUBLISH_PERMISSION)) {
        throw new ForbiddenException('Publishing a product requires product:publish');
      }
      return {
        locale: row.locale,
        name: row.name,
        tagline: row.tagline,
        summary: row.summary,
        body: (row.body ?? {}) as Prisma.InputJsonValue,
        status,
        publishedAt:
          status === ContentStatus.PUBLISHED ? (existing?.publishedAt ?? new Date()) : null,
        ogImageId: row.ogImageId,
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
        noIndex: row.noIndex ?? false,
      };
    });
  }

  private async publicLocales(locale: string): Promise<string[]> {
    const languages = await this.prisma.language.findMany({
      where: { isEnabled: true },
      select: { code: true, isDefault: true },
    });
    if (!languages.some(({ code }) => code === locale))
      throw new BadRequestException('Locale is not enabled');
    const fallback = languages.find(({ isDefault }) => isDefault)?.code;
    return [...new Set([locale, ...(fallback ? [fallback] : [])])];
  }

  private publicProduct(product: any, locales: string[]) {
    const translation =
      locales
        .map((locale) => product.translations?.find((item: any) => item.locale === locale))
        .find(Boolean) ?? product.translations?.[0];

    const title = product.title || translation?.name || product.slug;
    const tagline = product.tagline || translation?.tagline || '';
    const description =
      product.shortDescription || product.description || translation?.summary || '';

    return {
      id: product.id,
      slug: product.slug,
      stage: product.stage,
      status: product.status,
      title,
      name: title,
      tagline,
      shortDescription: product.shortDescription || description,
      description,
      summary: description,
      categoryName: product.category?.name || 'Software Product',
      categorySlug: product.category?.slug,
      categoryIcon: product.category?.icon,
      productType: product.productType,
      images: product.images || [],
      primaryImage:
        product.mediaItems?.find((m: any) => m.isPrimary)?.url ||
        product.mediaItems?.[0]?.url ||
        product.images?.[0] ||
        null,
      mediaItems: product.mediaItems || [],
      features: (product.richFeatures || []).slice(0, 4),
      links: product.links || [],
      liveUrl: product.liveUrl || product.productSiteUrl || product.demoUrl || null,
      brandColor: product.brandColor,
      isFeatured: product.isFeatured,
      displayOrder: product.displayOrder,
      homepageOrder: product.homepageOrder,
      navOrder: product.navOrder,
      publishedAt: product.createdAt,
    };
  }

  private publicProductDetail(product: any, locales: string[]) {
    const translation =
      locales
        .map((locale) => product.translations?.find((item: any) => item.locale === locale))
        .find(Boolean) ?? product.translations?.[0];

    const title = product.title || translation?.name || product.slug;
    const tagline = product.tagline || translation?.tagline || '';
    const description = product.description || translation?.summary || '';

    return {
      id: product.id,
      slug: product.slug,
      stage: product.stage,
      status: product.status,
      title,
      name: title,
      tagline,
      shortDescription: product.shortDescription || description,
      description,
      targetAudience: product.targetAudience,
      problemsAddressed: product.problemsAddressed,
      mainPurpose: product.mainPurpose,
      productType: product.productType,
      version: product.version,
      category: product.category,
      categoryName: product.category?.name || 'Software Product',
      brandColor: product.brandColor,
      logoUrl: product.logoUrl,
      thumbnailUrl: product.thumbnailUrl,
      images: product.images || [],
      mediaItems: product.mediaItems || [],
      features: product.richFeatures || [],
      benefits: product.benefits || [],
      links: product.links || [],
      demonstrations: product.demonstrations || [],
      faqs: product.productFaqs || [],
      caseStudies: product.caseStudies || [],
      liveUrl: product.liveUrl || product.productSiteUrl || product.demoUrl || null,
      isFeatured: product.isFeatured,
      enableGallery: product.enableGallery,
      enableCaseStudies: product.enableCaseStudies,
      enableDemos: product.enableDemos,
      enableFaq: product.enableFaq,
      seo: {
        seoTitle: product.seoTitle || title,
        seoDescription: product.seoDescription || product.shortDescription || description,
        seoKeywords: product.seoKeywords,
        canonicalUrl: product.canonicalUrl,
        ogTitle: product.ogTitle || title,
        ogDescription: product.ogDescription || description,
        ogImage: product.ogImage || product.mediaItems?.[0]?.url || product.images?.[0],
        twitterImage: product.twitterImage || product.ogImage,
        noIndex: product.noIndex,
      },
    };
  }

  private toAdmin(product: any) {
    const title = product.title || product.translations?.[0]?.name || product.slug;
    const tagline = product.tagline || product.translations?.[0]?.tagline || '';
    const description = product.description || product.translations?.[0]?.summary || '';

    return {
      id: product.id,
      slug: product.slug,
      stage: product.stage,
      status: product.status,
      title,
      name: title,
      tagline,
      shortDescription: product.shortDescription,
      description,
      summary: description,
      productType: product.productType,
      version: product.version,
      categoryId: product.categoryId,
      categoryName: product.category?.name,
      images: product.images || [],
      liveUrl: product.liveUrl || product.productSiteUrl || product.demoUrl || '',
      brandColor: product.brandColor,
      isFeatured: product.isFeatured,
      showOnHomepage: product.showOnHomepage,
      showOnProductsPage: product.showOnProductsPage,
      showInNavDropdown: product.showInNavDropdown,
      sortOrder: product.sortOrder,
      displayOrder: product.displayOrder,
      homepageOrder: product.homepageOrder,
      navOrder: product.navOrder,
      featuredOrder: product.featuredOrder,
      counts: product._count,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      translations: product.translations,
    };
  }

  private toAdminDetail(product: any) {
    const title = product.title || product.translations?.[0]?.name || product.slug;
    const tagline = product.tagline || product.translations?.[0]?.tagline || '';
    const description = product.description || product.translations?.[0]?.summary || '';

    return {
      ...product,
      title,
      name: title,
      tagline,
      description,
      summary: description,
      categoryName: product.category?.name,
    };
  }

  private result<T>(data: T[], total: number, query: QueryProductDto) {
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private handleDbError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ConflictException('A product with this slug already exists');
      if (error.code === 'P2025') throw new NotFoundException('Product not found');
      if (error.code === 'P2003')
        throw new BadRequestException('A referenced category or relation does not exist');
    }
    throw error;
  }
}
