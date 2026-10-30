import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UpdateCompanyDto } from './dto/update-company.dto';

const PROFILE_KEY = 'company.profile';
const asJson = (value: Record<string, unknown>): never => value as never;

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPublic() {
    const setting = await this.prisma.siteSetting.findUnique({ where: { key: PROFILE_KEY } });
    if (!setting || !setting.isPublic) throw new NotFoundException('Company profile not found');
    return setting.value;
  }

  async getAdmin() {
    const setting = await this.prisma.siteSetting.findUnique({ where: { key: PROFILE_KEY } });
    if (!setting) throw new NotFoundException('Company profile not found');
    return { ...setting, value: setting.value };
  }

  async save(dto: UpdateCompanyDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.siteSetting.findUnique({ where: { key: PROFILE_KEY } });
    if (!existing && (!dto.name || dto.isPublic === undefined)) {
      throw new BadRequestException('Creating a company profile requires name and isPublic');
    }

    const current =
      existing?.value && typeof existing.value === 'object' && !Array.isArray(existing.value)
        ? (existing.value as Record<string, unknown>)
        : {};
    const entries = Object.entries(dto).filter(
      ([key, value]) => key !== 'isPublic' && value !== undefined,
    );
    const value = Object.fromEntries([...Object.entries(current), ...entries]);
    const data = {
      value: asJson(value),
      updatedById: actor.id,
      ...(dto.isPublic === undefined ? {} : { isPublic: dto.isPublic }),
    };
    const setting = existing
      ? await this.prisma.siteSetting.update({ where: { key: PROFILE_KEY }, data })
      : await this.prisma.siteSetting.create({
          data: {
            key: PROFILE_KEY,
            group: 'company',
            value: asJson(value),
            isPublic: dto.isPublic as boolean,
            updatedById: actor.id,
          },
        });
    await this.audit(actor);
    return setting;
  }

  private async audit(actor: AuthenticatedUser): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'company.profile.update',
          entityType: 'site_setting',
          entityId: PROFILE_KEY,
          diff: { key: PROFILE_KEY } as never,
        },
      });
    } catch {
      this.logger.warn('Could not write company profile audit event');
    }
  }
}
