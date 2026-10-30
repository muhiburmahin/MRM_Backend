import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Faq } from '@prisma/client';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../../../database/prisma.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { AdminQueryFaqDto, QueryFaqDto } from './dto/query-faq.dto';

type LocalizedFaq = { question: string; answer: string };
const PUBLISH_PERMISSION = 'content:publish';

@Injectable()
export class FaqsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: QueryFaqDto) {
    const locales = await this.publicLocales(query.locale);
    const rows = await this.prisma.faq.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: query.order },
    });
    const visible = rows
      .map((faq) => this.toLocalized(faq, locales))
      .filter((faq): faq is NonNullable<typeof faq> => Boolean(faq))
      .filter(({ question, answer }) => !query.search || `${question} ${answer}`.toLowerCase().includes(query.search.toLowerCase()));
    const start = (query.page - 1) * query.limit;
    const data = visible.slice(start, start + query.limit);
    return {
      data,
      meta: { page: query.page, limit: query.limit, total: visible.length, totalPages: Math.ceil(visible.length / query.limit) },
    };
  }

  async findPublic(id: string, locale = 'en') {
    const locales = await this.publicLocales(locale);
    const faq = await this.prisma.faq.findUnique({ where: { id } });
    const localized = faq?.isPublished ? this.toLocalized(faq, locales) : undefined;
    if (!localized) throw new NotFoundException('FAQ not found');
    return localized;
  }

  async listAdmin(query: AdminQueryFaqDto) {
    const where: Prisma.FaqWhereInput = {
      ...(query.isPublished !== undefined && { isPublished: query.isPublished }),
      ...(query.search && {
        i18n: { string_contains: query.search },
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.faq.findMany({
        where,
        orderBy: { [query.sortBy]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.faq.count({ where }),
    ]);
    return { data: items.map((faq) => this.toAdmin(faq)), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOneAdmin(id: string) {
    const faq = await this.prisma.faq.findUnique({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');
    return this.toAdmin(faq);
  }

  async create(dto: CreateFaqDto, actor: AuthenticatedUser) {
    this.assertPublishAllowed(dto.isPublished ?? false, actor);
    const i18n = await this.validateTranslations(dto.i18n);
    try {
      const faq = await this.prisma.faq.create({
        data: {
          i18n,
          productId: dto.productId,
          serviceId: dto.serviceId,
          sortOrder: dto.sortOrder ?? 0,
          isPublished: dto.isPublished ?? false,
        },
      });
      return this.toAdmin(faq);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async update(id: string, dto: UpdateFaqDto, actor: AuthenticatedUser) {
    await this.findOneAdmin(id);
    const i18n = dto.i18n === undefined ? undefined : await this.validateTranslations(dto.i18n);
    if (dto.isPublished === true) this.assertPublishAllowed(true, actor);
    try {
      const faq = await this.prisma.faq.update({
        where: { id },
        data: {
          i18n,
          productId: dto.productId,
          serviceId: dto.serviceId,
          sortOrder: dto.sortOrder,
          isPublished: dto.isPublished,
        },
      });
      return this.toAdmin(faq);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    try {
      await this.prisma.faq.delete({ where: { id } });
    } catch (error) {
      this.handleDbError(error);
    }
    return { message: 'FAQ deleted' };
  }

  private async validateTranslations(value: Record<string, LocalizedFaq>): Promise<Prisma.InputJsonValue> {
    const entries = Object.entries(value);
    if (!entries.length) throw new BadRequestException('At least one FAQ translation is required');
    const languages = await this.prisma.language.findMany({
      where: { code: { in: entries.map(([locale]) => locale) }, isEnabled: true },
      select: { code: true },
    });
    if (languages.length !== entries.length) throw new BadRequestException('Every FAQ locale must be enabled');
    for (const [locale, item] of entries) {
      if (!item || typeof item.question !== 'string' || !item.question.trim() || typeof item.answer !== 'string' || !item.answer.trim()) {
        throw new BadRequestException(`FAQ translation "${locale}" needs a question and answer`);
      }
      if (item.question.length > 300 || item.answer.length > 5000) {
        throw new BadRequestException(`FAQ translation "${locale}" is too long`);
      }
    }
    return value as Prisma.InputJsonValue;
  }

  private async publicLocales(locale: string): Promise<string[]> {
    const languages = await this.prisma.language.findMany({
      where: { isEnabled: true },
      select: { code: true, isDefault: true },
    });
    if (!languages.some(({ code }) => code === locale)) throw new BadRequestException('Locale is not enabled');
    const fallback = languages.find(({ isDefault }) => isDefault)?.code;
    return [...new Set([locale, ...(fallback ? [fallback] : [])])];
  }

  private toLocalized(faq: { id: string; i18n: Prisma.JsonValue; sortOrder: number }, locales: string[]) {
    const translations = faq.i18n as Record<string, LocalizedFaq>;
    const content = locales.map((locale) => translations?.[locale]).find((item) => item?.question && item?.answer);
    return content ? { id: faq.id, question: content.question, answer: content.answer } : undefined;
  }

  private assertPublishAllowed(isPublished: boolean, actor: AuthenticatedUser) {
    if (isPublished && !actor.permissions.includes(PUBLISH_PERMISSION)) {
      throw new ForbiddenException('Publishing an FAQ requires content:publish');
    }
  }

  private toAdmin(faq: Faq) {
    return {
      id: faq.id,
      productId: faq.productId,
      serviceId: faq.serviceId,
      i18n: faq.i18n,
      isPublished: faq.isPublished,
      sortOrder: faq.sortOrder,
    };
  }

  private handleDbError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') throw new NotFoundException('FAQ not found');
      if (error.code === 'P2003') throw new BadRequestException('The selected product or service does not exist');
    }
    throw error;
  }
}
