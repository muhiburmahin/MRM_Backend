import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../../../database/prisma.service';
import type { CreatePageDto } from './dto/create-page.dto';
import type { CreatePageTranslationDto } from './dto/page-translation.dto';
import type { AdminPageQueryDto } from './dto/page-query.dto';
import type { UpdatePageDto } from './dto/update-page.dto';

const PUBLISH_PERMISSION = 'page:publish';
const BLOCK_TYPES = [
  'hero',
  'rich_text',
  'product_grid',
  'service_grid',
  'feature_list',
  'stats',
  'logo_wall',
  'testimonials',
  'case_studies',
  'process_steps',
  'faq',
  'cta_band',
  'contact_form',
  'post_list',
  'office_list',
  'image_text',
  'video',
  'reusable',
] as const;
const PAGE_TEMPLATES = new Set(['default', 'home', 'contact', 'legal', 'landing']);
const prismaCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
const hasControlCharacters = (value: string): boolean =>
  [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });

type PageTranslationInput = CreatePageTranslationDto & {
  blocks: unknown[];
  jsonLd?: Record<string, unknown>;
};

const pageBlockSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    type: z.enum(BLOCK_TYPES),
    data: z.record(z.string(), z.unknown()),
  })
  .strict();

const pageBlocksSchema = z
  .array(pageBlockSchema)
  .max(100)
  .superRefine((blocks, context) => {
    const ids = new Set<string>();
    for (const [index, block] of blocks.entries()) {
      if (ids.has(block.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate page block id: ${block.id}`,
          path: [index, 'id'],
        });
      }
      ids.add(block.id);
    }
  });

@Injectable()
export class PagesService {
  private readonly logger = new Logger(PagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listAdmin(query: AdminPageQueryDto) {
    const where: Prisma.PageWhereInput = query.search
      ? {
          OR: [
            { key: { contains: query.search, mode: 'insensitive' } },
            {
              translations: {
                some: {
                  OR: [
                    { title: { contains: query.search, mode: 'insensitive' } },
                    { path: { contains: query.search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }
      : {};
    const [total, data] = await Promise.all([
      this.prisma.page.count({ where }),
      this.prisma.page.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          key: true,
          template: true,
          isSystem: true,
          parentId: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          translations: {
            select: { locale: true, path: true, title: true, status: true, publishedAt: true },
            orderBy: { locale: 'asc' },
          },
        },
      }),
    ]);
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

  async getAdmin(id: string) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: {
        id: true,
        key: true,
        template: true,
        isSystem: true,
        parentId: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        translations: { orderBy: { locale: 'asc' } },
      },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async getPublicByPath(path: string, requestedLocale?: string) {
    this.validatePath(path);
    const languages = await this.prisma.language.findMany({
      where: { isEnabled: true },
      select: { code: true, isDefault: true },
    });
    if (languages.length === 0) throw new NotFoundException('Page not found');
    const defaultLocale = languages.find(({ isDefault }) => isDefault)?.code ?? languages[0].code;
    const locale = requestedLocale ?? defaultLocale;
    if (!languages.some(({ code }) => code === locale)) {
      throw new BadRequestException('Locale is not enabled');
    }

    const now = new Date();
    const publicTranslation = {
      OR: [
        { status: ContentStatus.PUBLISHED, publishedAt: { lte: now } },
        { status: ContentStatus.SCHEDULED, scheduledAt: { lte: now } },
      ],
    };
    for (const candidateLocale of [...new Set([locale, defaultLocale])]) {
      const page = await this.prisma.page.findFirst({
        where: {
          translations: {
            some: { locale: candidateLocale, path, ...publicTranslation },
          },
        },
        select: {
          key: true,
          template: true,
          translations: {
            where: publicTranslation,
            select: {
              locale: true,
              path: true,
              title: true,
              blocks: true,
              seoTitle: true,
              seoDescription: true,
              canonicalUrl: true,
              ogImageId: true,
              jsonLd: true,
              noIndex: true,
            },
            orderBy: { locale: 'asc' },
          },
        },
      });
      const translation = page?.translations.find(
        (item) => item.locale === candidateLocale && item.path === path,
      );
      if (page && translation) {
        return {
          key: page.key,
          template: page.template,
          ...translation,
          availableLocales: page.translations.map((item) => item.locale),
        };
      }
    }
    throw new NotFoundException('Page not found');
  }

  async create(dto: CreatePageDto, actor: AuthenticatedUser) {
    this.validatePageFields(dto.key, dto.template ?? 'default', dto.sortOrder ?? 0);
    await this.validateParent(dto.parentId);
    const localeCodes = dto.translations.map(({ locale }) => locale);
    this.assertUniqueLocales(localeCodes);
    await this.assertEnabledLocales(localeCodes);
    const translationData = await Promise.all(
      dto.translations.map((translation) => this.translationCreateData(translation, actor)),
    );
    try {
      const page = await this.prisma.page.create({
        data: {
          key: dto.key,
          template: dto.template ?? 'default',
          parentId: dto.parentId,
          sortOrder: dto.sortOrder ?? 0,
          translations: { create: translationData },
        },
        select: { id: true },
      });
      await this.audit(actor, 'page.create', page.id);
      return this.getAdmin(page.id);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async update(id: string, dto: UpdatePageDto, actor: AuthenticatedUser) {
    const current = await this.prisma.page.findUnique({
      where: { id },
      select: {
        id: true,
        key: true,
        template: true,
        parentId: true,
        sortOrder: true,
        translations: true,
      },
    });
    if (!current) throw new NotFoundException('Page not found');

    const key = dto.key ?? current.key;
    const template = dto.template ?? current.template;
    const sortOrder = dto.sortOrder ?? current.sortOrder;
    this.validatePageFields(key, template, sortOrder);
    if (dto.parentId !== undefined) await this.validateParent(dto.parentId, id);

    const upserts = [];
    if (dto.translations !== undefined) {
      const localeCodes = dto.translations.map(({ locale }) => locale);
      this.assertUniqueLocales(localeCodes);
      await this.assertEnabledLocales(localeCodes);
      for (const translation of dto.translations) {
        const existing = current.translations.find(({ locale }) => locale === translation.locale);
        const create = await this.translationCreateData(translation, actor);
        if (existing?.status === ContentStatus.PUBLISHED) this.requirePublisher(actor);
        const update = await this.translationUpdateData(translation, actor, existing);
        upserts.push({
          where: { pageId_locale: { pageId: id, locale: translation.locale } },
          create,
          update,
        });
      }
    }

    try {
      await this.prisma.page.update({
        where: { id },
        data: {
          key: dto.key,
          template: dto.template,
          parentId: dto.parentId,
          sortOrder: dto.sortOrder,
          ...(upserts.length > 0 ? { translations: { upsert: upserts } } : {}),
        },
      });
      await this.audit(actor, 'page.update', id);
      return this.getAdmin(id);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: {
        id: true,
        isSystem: true,
        _count: { select: { children: true, policies: true } },
      },
    });
    if (!page) throw new NotFoundException('Page not found');
    if (page.isSystem) throw new ConflictException('System pages cannot be deleted');
    if (page._count.children > 0) throw new ConflictException('Move or delete child pages first');
    if (page._count.policies > 0) {
      throw new ConflictException('Pages referenced by policy versions cannot be deleted');
    }
    try {
      await this.prisma.page.delete({ where: { id } });
    } catch (error) {
      this.handleDbError(error);
    }
    await this.audit(actor, 'page.delete', id);
    return { message: 'Page deleted' };
  }

  private async translationCreateData(
    translation: PageTranslationInput,
    actor: AuthenticatedUser,
  ): Promise<Prisma.PageTranslationCreateWithoutPageInput> {
    const status = translation.status ?? ContentStatus.DRAFT;
    this.assertPublication(status, translation.scheduledAt, actor);
    this.validateTranslation(translation);
    await this.validateOgImage(translation.ogImageId);
    return {
      path: translation.path,
      title: translation.title.trim(),
      blocks: this.toJson(translation.blocks),
      status,
      publishedAt: status === ContentStatus.PUBLISHED ? new Date() : null,
      scheduledAt: status === ContentStatus.SCHEDULED ? new Date(translation.scheduledAt!) : null,
      seoTitle: translation.seoTitle?.trim() || null,
      seoDescription: translation.seoDescription?.trim() || null,
      canonicalUrl: translation.canonicalUrl?.trim() || null,
      ogImageId: translation.ogImageId ?? null,
      ...(translation.jsonLd === undefined ? {} : { jsonLd: this.toJson(translation.jsonLd) }),
      noIndex: translation.noIndex ?? false,
      updatedById: actor.id,
      language: { connect: { code: translation.locale } },
    };
  }

  private async translationUpdateData(
    translation: PageTranslationInput,
    actor: AuthenticatedUser,
    existing:
      | {
          status: ContentStatus;
          publishedAt: Date | null;
          scheduledAt: Date | null;
        }
      | undefined,
  ): Promise<Prisma.PageTranslationUpdateWithoutPageInput> {
    const status = translation.status ?? existing?.status ?? ContentStatus.DRAFT;
    this.assertPublication(
      status,
      translation.scheduledAt ?? existing?.scheduledAt?.toISOString(),
      actor,
      translation.scheduledAt === undefined &&
        existing !== undefined &&
        existing.scheduledAt !== null,
    );
    this.validateTranslation(translation);
    await this.validateOgImage(translation.ogImageId);
    return {
      path: translation.path,
      title: translation.title.trim(),
      blocks: this.toJson(translation.blocks),
      status,
      publishedAt:
        status === ContentStatus.PUBLISHED ? (existing?.publishedAt ?? new Date()) : null,
      scheduledAt:
        status === ContentStatus.SCHEDULED
          ? translation.scheduledAt
            ? new Date(translation.scheduledAt)
            : existing?.scheduledAt
          : null,
      seoTitle:
        translation.seoTitle === undefined ? undefined : translation.seoTitle.trim() || null,
      seoDescription:
        translation.seoDescription === undefined
          ? undefined
          : translation.seoDescription.trim() || null,
      canonicalUrl:
        translation.canonicalUrl === undefined
          ? undefined
          : translation.canonicalUrl.trim() || null,
      ogImageId: translation.ogImageId,
      jsonLd: translation.jsonLd === undefined ? undefined : this.toJson(translation.jsonLd),
      noIndex: translation.noIndex,
      updatedById: actor.id,
    };
  }

  private validateTranslation(translation: PageTranslationInput): void {
    this.validatePath(translation.path);
    if (!translation.title.trim()) throw new BadRequestException('Page title cannot be empty');
    if (translation.title.length > 200) throw new BadRequestException('Page title is too long');
    const blockResult = pageBlocksSchema.safeParse(translation.blocks);
    if (!blockResult.success) {
      throw new BadRequestException(`Invalid page blocks: ${blockResult.error.issues[0].message}`);
    }
    for (const block of blockResult.data) this.assertJson(block.data);
    if (translation.seoTitle && translation.seoTitle.length > 200) {
      throw new BadRequestException('SEO title is too long');
    }
    if (translation.seoDescription && translation.seoDescription.length > 500) {
      throw new BadRequestException('SEO description is too long');
    }
    if (translation.canonicalUrl) this.validateCanonicalUrl(translation.canonicalUrl);
    if (translation.jsonLd !== undefined) this.assertJson(translation.jsonLd);
  }

  private async validateOgImage(id?: string): Promise<void> {
    if (!id) return;
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      select: { id: true, kind: true },
    });
    if (!asset || asset.kind !== 'IMAGE') {
      throw new BadRequestException('Open Graph image must reference an existing image asset');
    }
  }

  private validatePath(path: string): void {
    if (
      path.length === 0 ||
      path.length > 500 ||
      !path.startsWith('/') ||
      path.startsWith('//') ||
      (path.length > 1 && path.endsWith('/')) ||
      /[?#\\\s]/.test(path) ||
      hasControlCharacters(path) ||
      /%(?:2f|5c)/i.test(path)
    ) {
      throw new BadRequestException(
        'Page path must be an absolute local path without query or fragment',
      );
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      throw new BadRequestException('Page path contains invalid URL encoding');
    }
    if (
      decoded.includes('\\') ||
      decoded.includes('//') ||
      /[?#]/.test(decoded) ||
      hasControlCharacters(decoded) ||
      decoded.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      throw new BadRequestException('Page path contains an invalid path segment');
    }
  }

  private validateCanonicalUrl(value: string): void {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('Canonical URL must be an absolute HTTP(S) URL');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new BadRequestException(
        'Canonical URL must be an absolute HTTP(S) URL without credentials',
      );
    }
  }

  private validatePageFields(key: string, template: string, sortOrder: number): void {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || key.length > 100) {
      throw new BadRequestException('Page key must be a lowercase kebab-case identifier');
    }
    if (!PAGE_TEMPLATES.has(template)) throw new BadRequestException('Unsupported page template');
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) {
      throw new BadRequestException('Page sort order must be between 0 and 100000');
    }
  }

  private async validateParent(parentId?: string | null, pageId?: string): Promise<void> {
    if (parentId === undefined || parentId === null) return;
    if (parentId === pageId) throw new BadRequestException('A page cannot be its own parent');
    const parent = await this.prisma.page.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parent) throw new BadRequestException('Parent page does not exist');
    if (pageId) {
      const pages = await this.prisma.page.findMany({ select: { id: true, parentId: true } });
      const parents = new Map(
        pages.map(({ id, parentId: currentParentId }) => [id, currentParentId]),
      );
      let ancestor: string | null | undefined = parentId;
      const visited = new Set<string>();
      while (ancestor) {
        if (ancestor === pageId)
          throw new BadRequestException('Page hierarchy cannot contain a cycle');
        if (visited.has(ancestor))
          throw new ConflictException('Existing page hierarchy contains a cycle');
        visited.add(ancestor);
        ancestor = parents.get(ancestor);
      }
    }
  }

  private assertPublication(
    status: ContentStatus,
    scheduledAt: string | undefined,
    actor: AuthenticatedUser,
    allowDueSchedule = false,
  ): void {
    if (status === ContentStatus.PUBLISHED) this.requirePublisher(actor);
    if (status === ContentStatus.SCHEDULED) {
      if (
        !scheduledAt ||
        !Number.isFinite(Date.parse(scheduledAt)) ||
        (!allowDueSchedule && Date.parse(scheduledAt) <= Date.now())
      ) {
        throw new BadRequestException('Scheduled pages require a future scheduledAt time');
      }
    } else if (scheduledAt !== undefined) {
      throw new BadRequestException('scheduledAt is only valid for scheduled pages');
    }
  }

  private requirePublisher(actor: AuthenticatedUser): void {
    if (!actor.permissions.includes(PUBLISH_PERMISSION)) {
      throw new ForbiddenException('Publishing a page requires page:publish');
    }
  }

  private assertUniqueLocales(locales: string[]): void {
    if (locales.length === 0 || new Set(locales).size !== locales.length) {
      throw new BadRequestException('Page translations must contain unique locales');
    }
  }

  private async assertEnabledLocales(locales: string[]): Promise<void> {
    const enabled = await this.prisma.language.findMany({
      where: { code: { in: locales }, isEnabled: true },
      select: { code: true },
    });
    if (enabled.length !== locales.length) {
      const found = new Set(enabled.map(({ code }) => code));
      const invalid = locales.find((locale) => !found.has(locale));
      throw new BadRequestException(`Unknown or disabled locale: ${invalid}`);
    }
  }

  private async audit(actor: AuthenticatedUser, action: string, pageId: string): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { actorId: actor.id, action, entityType: 'page', entityId: pageId },
      });
    } catch (error) {
      this.logger.warn(
        `Could not write ${action} audit event: ${prismaCode(error) ?? 'database error'}`,
      );
    }
  }

  private assertJson(value: unknown, depth = 0): void {
    if (depth > 20) throw new BadRequestException('Page JSON is nested too deeply');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) {
      for (const item of value) this.assertJson(item, depth + 1);
      return;
    }
    if (this.isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) {
          throw new BadRequestException('Page JSON contains a forbidden property');
        }
        this.assertJson(item, depth + 1);
      }
      return;
    }
    throw new BadRequestException('Page content must be valid JSON');
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    this.assertJson(value);
    return value as Prisma.InputJsonValue;
  }

  private handleDbError(error: unknown): never {
    const code = prismaCode(error);
    if (code === 'P2002') {
      throw new ConflictException('Page key or locale path already exists');
    }
    if (code === 'P2003') {
      throw new ConflictException('Page is referenced by another record');
    }
    if (code === 'P2025') throw new NotFoundException('Page not found');
    throw error;
  }
}
