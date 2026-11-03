import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ContentStatus, Prisma } from '@prisma/client';
import type { Post, PostTranslation } from '@prisma/client';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../../../database/prisma.service';
import { CreateBlogDto, CreatePostTranslationDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { AdminQueryBlogDto, QueryBlogDto } from './dto/query-blog.dto';
import { CreateCategoryDto, CreateTagDto, UpdateCategoryDto } from './dto/category-tag.dto';

const PUBLISH_PERMISSION = 'post:publish';

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: QueryBlogDto) {
    const locales = await this.publicLocales(query.locale);
    const where: Prisma.PostWhereInput = {
      translations: {
        some: {
          locale: { in: locales },
          status: ContentStatus.PUBLISHED,
          publishedAt: { lte: new Date() },
          ...(query.search && {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { excerpt: { contains: query.search, mode: 'insensitive' } },
            ],
          }),
        },
      },
    };
    const [posts, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: {
          translations: {
            where: {
              locale: { in: locales },
              status: ContentStatus.PUBLISHED,
              publishedAt: { lte: new Date() },
            },
          },
        },
        orderBy: { [query.sortBy]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.post.count({ where }),
    ]);
    return this.result(
      posts.map((post) => this.publicPost(post, locales, undefined, false)),
      total,
      query,
    );
  }

  async findPublicBySlug(slug: string, locale = 'en') {
    const locales = await this.publicLocales(locale);
    const now = new Date();
    const translations = await this.prisma.postTranslation.findMany({
      where: {
        slug,
        locale: { in: locales },
        status: ContentStatus.PUBLISHED,
        publishedAt: { lte: now },
      },
      include: { post: true },
    });
    const translation = locales
      .map((localeCode) => translations.find((item) => item.locale === localeCode))
      .find(Boolean);
    if (!translation) throw new NotFoundException('Post not found');
    return this.publicPost(
      { ...translation.post, translations: [translation] },
      locales,
      translation,
    );
  }

  async listAdmin(query: AdminQueryBlogDto) {
    const where: Prisma.PostWhereInput = {
      AND: [
        ...(query.search
          ? [
              {
                translations: {
                  some: {
                    OR: [
                      { title: { contains: query.search, mode: 'insensitive' as const } },
                      { excerpt: { contains: query.search, mode: 'insensitive' as const } },
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
    const [posts, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: { translations: true, tags: { include: { tag: true } } },
        orderBy: { [query.sortBy]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.post.count({ where }),
    ]);
    return this.result(
      posts.map((post) => this.toAdmin(post)),
      total,
      query,
    );
  }

  async findOneAdmin(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { translations: true, tags: { include: { tag: true } } },
    });
    if (!post) throw new NotFoundException('Post not found');
    return this.toAdmin(post);
  }

  async create(dto: CreateBlogDto, actor: AuthenticatedUser) {
    const translations = await this.translationsData(dto.translations, actor);
    try {
      const post = await this.prisma.post.create({
        data: {
          key: randomUUID(),
          categoryId: dto.categoryId,
          coverId: dto.coverId,
          readingMinutes: dto.readingMinutes,
          isFeatured: dto.isFeatured ?? false,
          translations: {
            create: translations.map(({ locale, ...data }) => ({
              ...data,
              language: { connect: { code: locale } },
            })),
          },
          tags: { create: dto.tagIds?.map((id) => ({ tag: { connect: { id } } })) },
        },
        include: { translations: true, tags: { include: { tag: true } } },
      });
      return this.toAdmin(post);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async update(id: string, dto: UpdateBlogDto, actor: AuthenticatedUser) {
    const existing = await this.findOneAdmin(id);
    const translations =
      dto.translations === undefined
        ? undefined
        : await this.translationsData(dto.translations, actor, existing.translations);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (translations) {
          for (const translation of translations) {
            const { locale, ...data } = translation;
            await tx.postTranslation.upsert({
              where: { postId_locale: { postId: id, locale } },
              create: { ...data, locale, postId: id },
              update: data,
            });
          }
        }
        const post = await tx.post.update({
          where: { id },
          data: {
            categoryId: dto.categoryId,
            coverId: dto.coverId,
            readingMinutes: dto.readingMinutes,
            isFeatured: dto.isFeatured,
            ...(dto.tagIds !== undefined && {
              tags: {
                deleteMany: {},
                create: dto.tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
              },
            }),
          },
          include: { translations: true, tags: { include: { tag: true } } },
        });
        return this.toAdmin(post);
      });
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    try {
      await this.prisma.post.delete({ where: { id } });
    } catch (error) {
      this.handleDbError(error);
    }
    return { message: 'Post deleted' };
  }

  private async translationsData(
    rows: CreatePostTranslationDto[],
    actor: AuthenticatedUser,
    existingRows?: Array<{ locale: string; status: ContentStatus; publishedAt: Date | null }>,
  ) {
    if (!rows.length || new Set(rows.map(({ locale }) => locale)).size !== rows.length) {
      throw new BadRequestException('At least one translation with a unique locale is required');
    }
    const locales = await this.prisma.language.findMany({
      where: { code: { in: rows.map(({ locale }) => locale) }, isEnabled: true },
      select: { code: true },
    });
    if (locales.length !== rows.length)
      throw new BadRequestException('Every translation locale must be enabled');
    return rows.map((row) =>
      this.translationData(
        row,
        actor,
        existingRows?.find((item) => item.locale === row.locale),
      ),
    );
  }

  private translationData(
    row: CreatePostTranslationDto,
    actor: AuthenticatedUser,
    existing?: { status: ContentStatus; publishedAt: Date | null },
  ) {
    const status = row.status ?? existing?.status ?? ContentStatus.DRAFT;
    if (status === ContentStatus.PUBLISHED && !actor.permissions.includes(PUBLISH_PERMISSION)) {
      throw new ForbiddenException('Publishing a post requires post:publish');
    }
    return {
      locale: row.locale,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      body: row.body,
      status,
      publishedAt:
        status === ContentStatus.PUBLISHED ? (existing?.publishedAt ?? new Date()) : null,
      ogImageId: row.ogImageId,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      noIndex: row.noIndex ?? false,
    };
  }

  private async publicLocales(locale: string): Promise<string[]> {
    const languages = await this.prisma.language.findMany({
      where: { isEnabled: true },
      select: { code: true, isDefault: true },
    });
    if (!languages.some((language) => language.code === locale)) {
      throw new BadRequestException('Locale is not enabled');
    }
    const fallback = languages.find(({ isDefault }) => isDefault)?.code;
    return [...new Set([locale, ...(fallback ? [fallback] : [])])];
  }

  private publicPost(
    post: Pick<Post, 'id' | 'key' | 'readingMinutes' | 'isFeatured'> & {
      translations: PostTranslation[];
    },
    locales: string[],
    selected?: PostTranslation,
    includeBody = true,
  ) {
    const translation =
      selected ??
      locales
        .map((locale) => post.translations.find((item) => item.locale === locale))
        .find(Boolean);
    if (!translation) throw new NotFoundException('Post not found');
    return {
      id: post.id,
      slug: translation.slug,
      title: translation.title,
      excerpt: translation.excerpt,
      ...(includeBody && { body: translation.body }),
      publishedAt: translation.publishedAt,
      readingMinutes: post.readingMinutes,
      isFeatured: post.isFeatured,
    };
  }

  private toAdmin(
    post: Prisma.PostGetPayload<{
      include: { translations: true; tags: { include: { tag: true } } };
    }>,
  ) {
    return {
      id: post.id,
      key: post.key,
      authorId: post.authorId,
      categoryId: post.categoryId,
      coverId: post.coverId,
      readingMinutes: post.readingMinutes,
      isFeatured: post.isFeatured,
      createdAt: post.createdAt,
      translations: post.translations,
      tags: post.tags.map(({ tag }) => ({ id: tag.id, slug: tag.slug, i18n: tag.i18n })),
    };
  }

  private result<T>(items: T[], total: number, query: QueryBlogDto) {
    return {
      data: items,
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
        throw new ConflictException('A post translation with this locale and slug already exists');
      if (error.code === 'P2025') throw new NotFoundException('Post not found');
      if (error.code === 'P2003')
        throw new BadRequestException('A referenced category or asset does not exist');
    }
    throw error;
  }

  async listCategories() {
    return this.prisma.postCategory.findMany({
      orderBy: { slug: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.prisma.postCategory.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Category with slug "${dto.slug}" already exists`);
    return this.prisma.postCategory.create({
      data: {
        slug: dto.slug,
        i18n: dto.i18n as Prisma.InputJsonValue,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.postCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.prisma.postCategory.findUnique({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException(`Category with slug "${dto.slug}" already exists`);
    }
    return this.prisma.postCategory.update({
      where: { id },
      data: {
        ...(dto.slug ? { slug: dto.slug } : {}),
        ...(dto.i18n ? { i18n: dto.i18n as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.postCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Category not found');
    await this.prisma.postCategory.delete({ where: { id } });
    return { success: true };
  }

  async listTags() {
    return this.prisma.tag.findMany({
      orderBy: { slug: 'asc' },
    });
  }

  async createTag(dto: CreateTagDto) {
    const existing = await this.prisma.tag.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Tag with slug "${dto.slug}" already exists`);
    return this.prisma.tag.create({
      data: {
        slug: dto.slug,
        i18n: dto.i18n as Prisma.InputJsonValue,
      },
    });
  }

  async deleteTag(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
    });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.tag.delete({ where: { id } });
    return { success: true };
  }
}
