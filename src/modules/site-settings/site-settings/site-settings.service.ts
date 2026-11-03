import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';
import { CreateRedirectDto } from './dto/redirect.dto';

const asJson = (value: unknown): Prisma.JsonNullValueInput | Prisma.InputJsonValue =>
  value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

function assertJsonValue(value: unknown, depth = 0): void {
  if (depth > 20) throw new BadRequestException('Setting value is nested too deeply');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    for (const item of value) assertJsonValue(item, depth + 1);
    return;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const item of Object.values(value)) assertJsonValue(item, depth + 1);
    return;
  }
  throw new BadRequestException('Setting value must be valid JSON');
}

@Injectable()
export class SiteSettingsService {
  private readonly logger = new Logger(SiteSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPublic() {
    const settings = await this.prisma.siteSetting.findMany({
      where: { isPublic: true },
      select: { key: true, group: true, value: true, updatedAt: true },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
    return { data: settings };
  }

  async listAdminRedirects() {
    return this.prisma.redirect.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRedirect(dto: CreateRedirectDto, actor: AuthenticatedUser) {
    const fromPath = dto.fromPath.startsWith('/') ? dto.fromPath : `/${dto.fromPath}`;
    const toPath =
      dto.toPath.startsWith('/') || dto.toPath.startsWith('http') ? dto.toPath : `/${dto.toPath}`;
    const existing = await this.prisma.redirect.findUnique({ where: { fromPath } });
    if (existing) {
      throw new ConflictException(`Redirect from "${fromPath}" already exists`);
    }
    const redirect = await this.prisma.redirect.create({
      data: {
        fromPath,
        toPath,
        statusCode: dto.statusCode ?? 301,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit(actor, 'redirect.create', redirect.id);
    return redirect;
  }

  async deleteRedirect(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.redirect.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Redirect not found');
    await this.prisma.redirect.delete({ where: { id } });
    await this.audit(actor, 'redirect.delete', id);
    return { success: true };
  }

  async getRedirects() {
    const redirects = await this.prisma.redirect.findMany({
      where: { isActive: true },
      select: {
        fromPath: true,
        toPath: true,
        statusCode: true,
      },
    });
    return { data: redirects };
  }

  async getSitemapData() {
    const [pages, products, services, caseStudies, posts, jobs] = await Promise.all([
      this.prisma.pageTranslation.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          path: true,
          locale: true,
          updatedAt: true,
        },
      }),
      this.prisma.productTranslation.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          locale: true,
          product: { select: { slug: true, updatedAt: true } },
        },
      }),
      this.prisma.serviceTranslation.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          locale: true,
          service: { select: { slug: true, updatedAt: true } },
        },
      }),
      this.prisma.caseStudyTranslation.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          locale: true,
          caseStudy: { select: { slug: true, publishedAt: true } },
        },
      }),
      this.prisma.postTranslation.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          slug: true,
          locale: true,
          publishedAt: true,
        },
      }),
      this.prisma.jobPosting.findMany({
        where: { isOpen: true },
        select: {
          slug: true,
          createdAt: true,
          translations: { select: { locale: true } },
        },
      }),
    ]);

    const items: Array<{
      path: string;
      locale: string;
      lastModified?: Date | null;
      type: 'page' | 'product' | 'service' | 'case-study' | 'blog' | 'career';
    }> = [];

    for (const p of pages) {
      items.push({
        path: p.path,
        locale: p.locale,
        lastModified: p.updatedAt,
        type: 'page',
      });
    }

    for (const prod of products) {
      items.push({
        path: `/products/${prod.product.slug}`,
        locale: prod.locale,
        lastModified: prod.product.updatedAt,
        type: 'product',
      });
    }

    for (const s of services) {
      items.push({
        path: `/services/${s.service.slug}`,
        locale: s.locale,
        lastModified: s.service.updatedAt,
        type: 'service',
      });
    }

    for (const cs of caseStudies) {
      items.push({
        path: `/case-studies/${cs.caseStudy.slug}`,
        locale: cs.locale,
        lastModified: cs.caseStudy.publishedAt,
        type: 'case-study',
      });
    }

    for (const post of posts) {
      items.push({
        path: `/blog/${post.slug}`,
        locale: post.locale,
        lastModified: post.publishedAt,
        type: 'blog',
      });
    }

    for (const j of jobs) {
      for (const t of j.translations) {
        items.push({
          path: `/careers/${j.slug}`,
          locale: t.locale,
          lastModified: j.createdAt,
          type: 'career',
        });
      }
    }

    return {
      data: items,
      total: items.length,
      generatedAt: new Date().toISOString(),
    };
  }

  async listAdmin() {
    return this.prisma.siteSetting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
  }

  async getAdmin(key: string) {
    const setting = await this.prisma.siteSetting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException('Site setting not found');
    return setting;
  }

  async create(dto: UpdateSiteSettingsDto, actor: AuthenticatedUser) {
    if (!dto.key) throw new BadRequestException('key is required');
    assertJsonValue(dto.value);
    const setting = await this.prisma.siteSetting.create({
      data: {
        key: dto.key,
        group: dto.group ?? 'general',
        value: asJson(dto.value),
        isPublic: dto.isPublic ?? false,
        updatedById: actor.id,
      },
    });
    await this.audit(actor, 'site_setting.create', setting.key);
    return setting;
  }

  async update(key: string, dto: UpdateSiteSettingsDto, actor: AuthenticatedUser) {
    await this.getAdmin(key);
    if (dto.value !== undefined) assertJsonValue(dto.value);
    const setting = await this.prisma.siteSetting.update({
      where: { key },
      data: {
        ...(dto.group === undefined ? {} : { group: dto.group }),
        ...(dto.value === undefined ? {} : { value: asJson(dto.value) }),
        ...(dto.isPublic === undefined ? {} : { isPublic: dto.isPublic }),
        updatedById: actor.id,
      },
    });
    await this.audit(actor, 'site_setting.update', key);
    return setting;
  }

  async remove(key: string, actor: AuthenticatedUser) {
    await this.getAdmin(key);
    await this.prisma.siteSetting.delete({ where: { key } });
    await this.audit(actor, 'site_setting.delete', key);
  }

  private async audit(actor: AuthenticatedUser, action: string, key: string): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action,
          entityType: 'site_setting',
          entityId: key,
          diff: { key } as never,
        },
      });
    } catch {
      this.logger.warn('Could not write site setting audit event');
    }
  }
}
