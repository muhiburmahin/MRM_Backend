import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { QueryMediaDto } from './dto/query-media.dto';
import { UploadMediaDto } from './dto/upload-media.dto';

const mediaSelect = {
  id: true,
  folderId: true,
  kind: true,
  storageKey: true,
  url: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  blurHash: true,
  alt: true,
  caption: true,
  createdAt: true,
} satisfies Prisma.MediaAssetSelect;

const prismaCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

const asJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: UploadMediaDto, actor: AuthenticatedUser) {
    if (dto.kind === 'IMAGE' && !this.hasLocalizedText(dto.alt)) {
      throw new BadRequestException('Localized alternative text is required for image assets');
    }
    if (
      dto.storageKey.split(/[\\/]/).some((part) => part === '..') ||
      dto.storageKey.startsWith('/')
    ) {
      throw new BadRequestException('storageKey must be a provider-relative key');
    }
    try {
      const { alt, caption, ...fields } = dto;
      const asset = await this.prisma.mediaAsset.create({
        data: {
          ...fields,
          folderId: dto.folderId ?? null,
          width: dto.width ?? null,
          height: dto.height ?? null,
          blurHash: dto.blurHash ?? null,
          alt: alt === undefined ? undefined : alt === null ? Prisma.DbNull : asJson(alt),
          caption:
            caption === undefined ? undefined : caption === null ? Prisma.DbNull : asJson(caption),
          uploadedById: actor.id,
        },
        select: mediaSelect,
      });
      await this.audit(actor, 'media.register', asset.id, {
        kind: asset.kind,
        mimeType: asset.mimeType,
      });
      return asset;
    } catch (error) {
      if (prismaCode(error) === 'P2002')
        throw new ConflictException('A media asset with this storage key already exists');
      if (prismaCode(error) === 'P2003')
        throw new BadRequestException('The selected media folder does not exist');
      throw error;
    }
  }

  async findAll(query: QueryMediaDto) {
    const where: Prisma.MediaAssetWhereInput = {
      ...(query.mimeType ? { mimeType: query.mimeType } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.folderId ? { folderId: query.folderId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({
        where,
        select: mediaSelect,
        orderBy: { [query.sortBy]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
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

  async findOne(id: string) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id }, select: mediaSelect });
    if (!media) throw new NotFoundException('Media not found');
    return media;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.findOne(id);
    if (await this.isInUse(id)) {
      throw new ConflictException('This asset is still referenced and cannot be deleted');
    }
    try {
      await this.prisma.mediaAsset.delete({ where: { id } });
      await this.audit(actor, 'media.delete', id, {});
    } catch (error) {
      if (prismaCode(error) === 'P2003') {
        throw new ConflictException('This asset is still referenced and cannot be deleted');
      }
      throw error;
    }
    return { message: 'Media deleted' };
  }

  private async isInUse(id: string): Promise<boolean> {
    const refs = await Promise.all([
      this.prisma.caseStudy.findFirst({ where: { coverId: id }, select: { id: true } }),
      this.prisma.client.findFirst({ where: { logoId: id }, select: { id: true } }),
      this.prisma.pageTranslation.findFirst({ where: { ogImageId: id }, select: { id: true } }),
      this.prisma.post.findFirst({ where: { coverId: id }, select: { id: true } }),
      this.prisma.postTranslation.findFirst({ where: { ogImageId: id }, select: { id: true } }),
      this.prisma.product.findFirst({
        where: { OR: [{ logoId: id }, { heroImageId: id }] },
        select: { id: true },
      }),
      this.prisma.productTranslation.findFirst({ where: { ogImageId: id }, select: { id: true } }),
      this.prisma.teamMember.findFirst({ where: { photoId: id }, select: { id: true } }),
      this.prisma.technology.findFirst({ where: { iconId: id }, select: { id: true } }),
      this.prisma.trustBadge.findFirst({ where: { logoId: id }, select: { id: true } }),
      this.prisma.theme.findFirst({
        where: {
          OR: [
            { logoLightId: id },
            { logoDarkId: id },
            { logoMarkId: id },
            { faviconId: id },
            { defaultOgId: id },
          ],
        },
        select: { id: true },
      }),
      this.prisma.user.findFirst({ where: { avatarId: id }, select: { id: true } }),
      this.prisma.fontAsset.findFirst({ where: { mediaId: id }, select: { id: true } }),
      this.prisma.productScreenshot.findFirst({ where: { mediaId: id }, select: { id: true } }),
      this.prisma.caseStudyMedia.findFirst({ where: { mediaId: id }, select: { id: true } }),
    ]);
    return refs.some(Boolean);
  }

  private hasLocalizedText(value: unknown): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    return Object.values(value).some(
      (entry) => typeof entry === 'string' && entry.trim().length > 0,
    );
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
          entityType: 'media_asset',
          entityId,
          diff: diff as never,
        },
      });
    } catch {
      this.logger.warn('Could not write media audit event');
    }
  }
}
