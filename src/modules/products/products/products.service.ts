import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import type { Product, ProductTranslation } from '@prisma/client';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../../../database/prisma.service';
import { CreateProductDto, ProductTranslationDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdminQueryProductDto, QueryProductDto } from './dto/query-product.dto';

const PUBLISH_PERMISSION = 'product:publish';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: QueryProductDto) {
    const locales = await this.publicLocales(query.locale);
    const now = new Date();
    const where: Prisma.ProductWhereInput = {
      stage: 'LIVE',
      translations: {
        some: {
          locale: { in: locales },
          status: ContentStatus.PUBLISHED,
          publishedAt: { lte: now },
          ...(query.search && {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { summary: { contains: query.search, mode: 'insensitive' } },
            ],
          }),
        },
      },
    };
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          translations: {
            where: {
              locale: { in: locales },
              status: ContentStatus.PUBLISHED,
              publishedAt: { lte: now },
            },
          },
        },
        orderBy: { [query.sortBy]: query.order },
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

  async findPublicBySlug(slug: string, locale = 'en') {
    const locales = await this.publicLocales(locale);
    const translations = await this.prisma.productTranslation.findMany({
      where: {
        product: { slug, stage: 'LIVE' },
        locale: { in: locales },
        status: ContentStatus.PUBLISHED,
        publishedAt: { lte: new Date() },
      },
      include: { product: true },
    });
    const translation = locales
      .map((code) => translations.find((item) => item.locale === code))
      .find(Boolean);
    if (!translation) throw new NotFoundException('Product not found');
    return this.publicProduct(
      { ...translation.product, translations: [translation] },
      locales,
      translation,
    );
  }

  async listAdmin(query: AdminQueryProductDto) {
    const where: Prisma.ProductWhereInput = {
      AND: [
        ...(query.search
          ? [
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
            ]
          : []),
        ...(query.isPublished !== undefined
          ? [
              {
                translations: query.isPublished
                  ? { some: { status: ContentStatus.PUBLISHED } }
                  : { none: { status: ContentStatus.PUBLISHED } },
              },
            ]
          : []),
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          translations: true,
          features: true,
          screenshots: true,
          plans: true,
          industries: true,
        },
        orderBy: { [query.sortBy]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return this.result(
      items.map((product) => this.toAdmin(product)),
      total,
      query,
    );
  }

  async findOneAdmin(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        translations: true,
        features: true,
        screenshots: true,
        plans: true,
        industries: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.toAdmin(product);
  }

  async create(dto: CreateProductDto, actor: AuthenticatedUser) {
    const translations = await this.translationsData(dto.translations, actor);
    try {
      const product = await this.prisma.product.create({
        data: {
          slug: dto.slug,
          stage: dto.stage,
          logoId: dto.logoId,
          heroImageId: dto.heroImageId,
          brandColor: dto.brandColor,
          productSiteUrl: dto.productSiteUrl,
          demoUrl: dto.demoUrl,
          privacyUrl: dto.privacyUrl,
          termsUrl: dto.termsUrl,
          isFeatured: dto.isFeatured ?? false,
          sortOrder: dto.sortOrder ?? 0,
          launchedAt: dto.launchedAt,
          translations: {
            create: translations.map(({ locale, ...data }) => ({
              ...data,
              language: { connect: { code: locale } },
            })),
          },
        },
        include: { translations: true },
      });
      return this.toAdmin(product);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async update(id: string, dto: UpdateProductDto, actor: AuthenticatedUser) {
    const existing = await this.findOneAdmin(id);
    if (
      dto.stage === 'LIVE' &&
      existing.stage !== 'LIVE' &&
      !actor.permissions.includes(PUBLISH_PERMISSION)
    ) {
      throw new ForbiddenException('Publishing a product requires product:publish');
    }
    const translations =
      dto.translations === undefined
        ? undefined
        : await this.translationsData(dto.translations, actor, existing.translations);
    try {
      const product = await this.prisma.$transaction(async (tx) => {
        if (translations) {
          for (const translation of translations) {
            const { locale, ...data } = translation;
            await tx.productTranslation.upsert({
              where: { productId_locale: { productId: id, locale } },
              create: { ...data, locale, productId: id },
              update: data,
            });
          }
        }
        return tx.product.update({
          where: { id },
          data: {
            slug: dto.slug,
            stage: dto.stage,
            logoId: dto.logoId,
            heroImageId: dto.heroImageId,
            brandColor: dto.brandColor,
            productSiteUrl: dto.productSiteUrl,
            demoUrl: dto.demoUrl,
            privacyUrl: dto.privacyUrl,
            termsUrl: dto.termsUrl,
            isFeatured: dto.isFeatured,
            sortOrder: dto.sortOrder,
            launchedAt: dto.launchedAt,
          },
          include: { translations: true },
        });
      });
      return this.toAdmin(product);
    } catch (error) {
      this.handleDbError(error);
    }
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

  private publicProduct(
    product: Pick<
      Product,
      | 'id'
      | 'slug'
      | 'stage'
      | 'brandColor'
      | 'productSiteUrl'
      | 'demoUrl'
      | 'isFeatured'
      | 'sortOrder'
    > & {
      translations: ProductTranslation[];
    },
    locales: string[],
    selected?: ProductTranslation,
  ) {
    const translation =
      selected ??
      locales
        .map((locale) => product.translations.find((item) => item.locale === locale))
        .find(Boolean);
    if (!translation) throw new NotFoundException('Product not found');
    return {
      id: product.id,
      slug: product.slug,
      stage: product.stage,
      brandColor: product.brandColor,
      productSiteUrl: product.productSiteUrl,
      demoUrl: product.demoUrl,
      isFeatured: product.isFeatured,
      sortOrder: product.sortOrder,
      name: translation.name,
      tagline: translation.tagline,
      summary: translation.summary,
      body: translation.body,
      publishedAt: translation.publishedAt,
    };
  }

  private toAdmin(product: Prisma.ProductGetPayload<{ include: { translations: true } }>) {
    return {
      id: product.id,
      slug: product.slug,
      stage: product.stage,
      logoId: product.logoId,
      heroImageId: product.heroImageId,
      brandColor: product.brandColor,
      productSiteUrl: product.productSiteUrl,
      demoUrl: product.demoUrl,
      privacyUrl: product.privacyUrl,
      termsUrl: product.termsUrl,
      isFeatured: product.isFeatured,
      sortOrder: product.sortOrder,
      launchedAt: product.launchedAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      translations: product.translations,
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
        throw new ConflictException('A product slug or locale translation already exists');
      if (error.code === 'P2025') throw new NotFoundException('Product not found');
      if (error.code === 'P2003')
        throw new BadRequestException('A referenced asset does not exist');
    }
    throw error;
  }
}
