import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';

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
