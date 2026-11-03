import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Testimonial } from '@prisma/client';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../../../database/prisma.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { AdminQueryTestimonialDto, QueryTestimonialDto } from './dto/query-testimonial.dto';

const PUBLISH_PERMISSION = 'content:publish';

@Injectable()
export class TestimonialsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: QueryTestimonialDto) {
    const locales = await this.publicLocales(query.locale);
    const where: Prisma.TestimonialWhereInput = {
      isVerified: true,
      showOnSite: true,
      evidenceNote: { not: null },
      consentAt: { not: null },
    };
    const rows = await this.prisma.testimonial.findMany({
      where,
      orderBy: { sortOrder: query.order },
    });
    const visible = rows
      .map((testimonial) => this.toPublic(testimonial, locales))
      .filter((testimonial): testimonial is NonNullable<typeof testimonial> =>
        Boolean(testimonial),
      );
    const start = (query.page - 1) * query.limit;
    const items = visible.slice(start, start + query.limit);
    const total = visible.length;
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

  async findPublic(id: string, locale = 'en') {
    const locales = await this.publicLocales(locale);
    const testimonial = await this.prisma.testimonial.findFirst({
      where: {
        id,
        isVerified: true,
        showOnSite: true,
        evidenceNote: { not: null },
        consentAt: { not: null },
      },
    });
    const item = testimonial ? this.toPublic(testimonial, locales) : undefined;
    if (!item) throw new NotFoundException('Testimonial not found');
    return item;
  }

  async listAdmin(query: AdminQueryTestimonialDto) {
    const where: Prisma.TestimonialWhereInput = {
      ...(query.showOnSite !== undefined && { showOnSite: query.showOnSite }),
      ...(query.isVerified !== undefined && { isVerified: query.isVerified }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.testimonial.findMany({
        where,
        orderBy: { [query.sortBy]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.testimonial.count({ where }),
    ]);
    return {
      data: items.map((testimonial) => this.toAdmin(testimonial)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOneAdmin(id: string) {
    const testimonial = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!testimonial) throw new NotFoundException('Testimonial not found');
    return this.toAdmin(testimonial);
  }

  async create(dto: CreateTestimonialDto, actor: AuthenticatedUser) {
    this.assertPublishAllowed(dto, actor);
    const quote = await this.validateQuote(dto.quote);
    try {
      const testimonial = await this.prisma.testimonial.create({
        data: {
          clientId: dto.clientId,
          authorName: dto.authorName,
          authorRole: dto.authorRole,
          quote,
          isVerified: dto.isVerified ?? false,
          evidenceNote: dto.evidenceNote,
          consentAt: dto.consentAt ? new Date(dto.consentAt) : null,
          showOnSite: dto.showOnSite ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      return this.toAdmin(testimonial);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async update(id: string, dto: UpdateTestimonialDto, actor: AuthenticatedUser) {
    const existing = await this.findOneAdmin(id);
    this.assertPublishAllowed(dto, actor, existing);
    const contentChanged =
      dto.quote !== undefined ||
      dto.authorName !== undefined ||
      dto.authorRole !== undefined ||
      dto.clientId !== undefined;
    if (existing.showOnSite && contentChanged && !actor.permissions.includes(PUBLISH_PERMISSION)) {
      throw new ForbiddenException('Changing a public testimonial requires content:publish');
    }
    const quote = dto.quote === undefined ? undefined : await this.validateQuote(dto.quote);
    try {
      const testimonial = await this.prisma.testimonial.update({
        where: { id },
        data: {
          clientId: dto.clientId,
          authorName: dto.authorName,
          authorRole: dto.authorRole,
          quote,
          isVerified: dto.isVerified,
          evidenceNote: dto.evidenceNote,
          consentAt:
            dto.consentAt === undefined
              ? undefined
              : dto.consentAt === null
                ? null
                : new Date(dto.consentAt),
          showOnSite: dto.showOnSite,
          sortOrder: dto.sortOrder,
        },
      });
      return this.toAdmin(testimonial);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    try {
      await this.prisma.testimonial.delete({ where: { id } });
    } catch (error) {
      this.handleDbError(error);
    }
    return { message: 'Testimonial deleted' };
  }

  private assertPublishAllowed(
    dto: Partial<CreateTestimonialDto>,
    actor: AuthenticatedUser,
    existing?: Awaited<ReturnType<TestimonialsService['findOneAdmin']>>,
  ) {
    if (
      (dto.isVerified === true || dto.showOnSite === true) &&
      !actor.permissions.includes(PUBLISH_PERMISSION)
    ) {
      throw new ForbiddenException(
        'Verifying or publishing a testimonial requires content:publish',
      );
    }
    const verified = dto.isVerified ?? existing?.isVerified ?? false;
    const showOnSite = dto.showOnSite ?? existing?.showOnSite ?? false;
    const evidenceNote = dto.evidenceNote ?? existing?.evidenceNote ?? undefined;
    const consentAt = dto.consentAt === undefined ? existing?.consentAt : dto.consentAt;
    if (verified && !evidenceNote?.trim()) {
      throw new BadRequestException('Written evidence is required to verify a testimonial');
    }
    if (showOnSite && (!verified || !evidenceNote?.trim() || !consentAt)) {
      throw new BadRequestException(
        'A testimonial must be verified, evidenced and consented before it can be public',
      );
    }
  }

  private async validateQuote(quote: Record<string, string>): Promise<Prisma.InputJsonValue> {
    const entries = Object.entries(quote);
    if (
      !entries.length ||
      entries.some(
        ([locale, text]) =>
          !locale || typeof text !== 'string' || !text.trim() || text.length > 2000,
      )
    ) {
      throw new BadRequestException(
        'Provide a non-empty quote of at most 2000 characters for each locale',
      );
    }
    const languages = await this.prisma.language.findMany({
      where: { code: { in: entries.map(([locale]) => locale) }, isEnabled: true },
      select: { code: true },
    });
    if (languages.length !== entries.length)
      throw new BadRequestException('Every testimonial locale must be enabled');
    return quote as Prisma.InputJsonValue;
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

  private toPublic(testimonial: Testimonial, locales: string[]) {
    if (
      !testimonial.isVerified ||
      !testimonial.showOnSite ||
      !testimonial.evidenceNote?.trim() ||
      !testimonial.consentAt
    )
      return undefined;
    const quote = testimonial.quote as Record<string, string>;
    const text = locales
      .map((locale) => quote?.[locale])
      .find((value) => typeof value === 'string' && value.trim());
    if (!text) return undefined;
    return {
      id: testimonial.id,
      authorName: testimonial.authorName,
      authorRole: testimonial.authorRole,
      quote: text,
    };
  }

  private toAdmin(testimonial: Testimonial) {
    return {
      id: testimonial.id,
      clientId: testimonial.clientId,
      authorName: testimonial.authorName,
      authorRole: testimonial.authorRole,
      quote: testimonial.quote,
      isVerified: testimonial.isVerified,
      evidenceNote: testimonial.evidenceNote,
      consentAt: testimonial.consentAt,
      showOnSite: testimonial.showOnSite,
      sortOrder: testimonial.sortOrder,
    };
  }

  private handleDbError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') throw new NotFoundException('Testimonial not found');
      if (error.code === 'P2003')
        throw new BadRequestException('The selected client does not exist');
    }
    throw error;
  }
}
