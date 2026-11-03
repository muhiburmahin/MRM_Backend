import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.client.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { caseStudies: true, testimonials: true } },
      },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        caseStudies: { select: { id: true, slug: true } },
        testimonials: { select: { id: true, authorName: true } },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async create(dto: CreateClientDto) {
    this.validateTrust(dto.isVerified ?? false, dto.evidenceNote, dto.showOnSite ?? false);

    return this.prisma.client.create({
      data: {
        name: dto.name,
        country: dto.country,
        logoId: dto.logoId,
        websiteUrl: dto.websiteUrl,
        isVerified: dto.isVerified ?? false,
        evidenceNote: dto.evidenceNote,
        permissionGrantedAt: dto.permissionGrantedAt ? new Date(dto.permissionGrantedAt) : null,
        showOnSite: dto.showOnSite ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateClientDto) {
    const existing = await this.findOne(id);

    const isVerified = dto.isVerified !== undefined ? dto.isVerified : existing.isVerified;
    const evidenceNote = dto.evidenceNote !== undefined ? dto.evidenceNote : existing.evidenceNote;
    const showOnSite = dto.showOnSite !== undefined ? dto.showOnSite : existing.showOnSite;

    this.validateTrust(isVerified, evidenceNote, showOnSite);

    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.logoId !== undefined ? { logoId: dto.logoId } : {}),
        ...(dto.websiteUrl !== undefined ? { websiteUrl: dto.websiteUrl } : {}),
        ...(dto.isVerified !== undefined ? { isVerified: dto.isVerified } : {}),
        ...(dto.evidenceNote !== undefined ? { evidenceNote: dto.evidenceNote } : {}),
        ...(dto.permissionGrantedAt !== undefined
          ? {
              permissionGrantedAt: dto.permissionGrantedAt
                ? new Date(dto.permissionGrantedAt)
                : null,
            }
          : {}),
        ...(dto.showOnSite !== undefined ? { showOnSite: dto.showOnSite } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async remove(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        _count: { select: { caseStudies: true, testimonials: true } },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    if (client._count.caseStudies > 0 || client._count.testimonials > 0) {
      throw new BadRequestException(
        'Cannot delete a client referenced by projects or testimonials',
      );
    }
    await this.prisma.client.delete({ where: { id } });
    return { success: true };
  }

  private validateTrust(
    isVerified: boolean,
    evidenceNote?: string | null,
    showOnSite?: boolean,
  ): void {
    if (isVerified && (!evidenceNote || evidenceNote.trim().length === 0)) {
      throw new BadRequestException('Verified clients must include an evidence note');
    }
    if (showOnSite && !isVerified) {
      throw new BadRequestException(
        'Clients visible on site must be verified with an evidence note',
      );
    }
  }
}
