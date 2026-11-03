import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { QueryJobsDto } from './dto/job-query.dto';
import { ApplyJobDto, CreateJobDto, UpdateJobDto, UpdateJobStatusDto } from './dto/job-write.dto';

const prismaCode = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined;

@Injectable()
export class CareersService {
  private readonly logger = new Logger(CareersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ───────────────────────── Public ─────────────────────────

  async listPublic(query: QueryJobsDto) {
    const locale = query.locale || 'en';
    const now = new Date();
    const where: Prisma.JobPostingWhereInput = {
      isOpen: true,
      OR: [{ closesAt: null }, { closesAt: { gt: now } }],
      ...(query.type ? { type: query.type } : {}),
      ...(query.isRemote !== undefined ? { isRemote: query.isRemote } : {}),
      ...(query.q
        ? {
            translations: {
              some: {
                title: { contains: query.q, mode: 'insensitive' },
              },
            },
          }
        : {}),
    };

    const [total, jobs] = await Promise.all([
      this.prisma.jobPosting.count({ where }),
      this.prisma.jobPosting.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          translations: {
            where: { locale },
            take: 1,
          },
        },
      }),
    ]);

    return {
      data: jobs.map((job) => ({
        slug: job.slug,
        type: job.type,
        location: job.location,
        isRemote: job.isRemote,
        title: job.translations[0]?.title ?? job.slug,
        closesAt: job.closesAt,
        createdAt: job.createdAt,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getBySlugPublic(slug: string, localeParam?: string) {
    const locale = localeParam || 'en';
    const now = new Date();
    const job = await this.prisma.jobPosting.findFirst({
      where: {
        slug,
        isOpen: true,
        OR: [{ closesAt: null }, { closesAt: { gt: now } }],
      },
      include: {
        translations: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job posting not found or is no longer open');
    }

    const translation = job.translations.find((t) => t.locale === locale) ?? job.translations[0];

    if (!translation) {
      throw new NotFoundException(`No translation available for job posting`);
    }

    return {
      slug: job.slug,
      type: job.type,
      location: job.location,
      isRemote: job.isRemote,
      title: translation.title,
      body: translation.body,
      locale: translation.locale,
      applyEmail: job.applyEmail,
      closesAt: job.closesAt,
      createdAt: job.createdAt,
      availableLocales: job.translations.map((t) => t.locale).sort(),
    };
  }

  async apply(slug: string, dto: ApplyJobDto) {
    if (dto.consentGiven !== true) {
      throw new BadRequestException('Consent is required to submit job application');
    }

    const job = await this.prisma.jobPosting.findFirst({
      where: { slug, isOpen: true },
      select: { id: true, slug: true, applyEmail: true },
    });

    if (!job) {
      throw new NotFoundException('Job posting not found or has closed');
    }

    const timestamp = new Date();
    const datePart = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
    const ref = `LD-${datePart}-${randomBytes(6).toString('hex').toUpperCase()}`;

    await this.prisma.lead.create({
      data: {
        ref,
        type: 'GENERAL',
        status: 'NEW',
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        message: dto.coverLetter || `Job Application for position: ${slug}`,
        payload: {
          kind: 'CAREER_APPLICATION',
          jobSlug: slug,
          resumeUrl: dto.resumeUrl ?? null,
        } as never,
        consentAt: timestamp,
      },
    });

    await this.mail.notifyNewLead({
      ref,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      message: `${dto.coverLetter || 'Job application submitted'}\nResume: ${dto.resumeUrl || 'Not provided'}`,
      type: 'CAREER',
    });

    await this.mail.sendCustomerConfirmation({
      ref,
      name: dto.name,
      email: dto.email,
    });

    return {
      message:
        'Application submitted successfully. We will review your application and get in touch.',
      ref,
    };
  }

  // ───────────────────────── Admin ─────────────────────────

  async listAdmin(query: QueryJobsDto) {
    const where: Prisma.JobPostingWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.isRemote !== undefined ? { isRemote: query.isRemote } : {}),
      ...(query.q
        ? {
            OR: [
              { slug: { contains: query.q, mode: 'insensitive' } },
              {
                translations: {
                  some: { title: { contains: query.q, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };

    const [total, jobs] = await Promise.all([
      this.prisma.jobPosting.count({ where }),
      this.prisma.jobPosting.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          translations: {
            select: { id: true, locale: true, title: true, body: true },
          },
        },
      }),
    ]);

    return {
      data: jobs,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getAdmin(id: string) {
    const job = await this.prisma.jobPosting.findUnique({
      where: { id },
      include: {
        translations: true,
      },
    });
    if (!job) throw new NotFoundException('Job posting not found');
    return job;
  }

  async create(dto: CreateJobDto, actor: AuthenticatedUser) {
    try {
      const created = await this.prisma.jobPosting.create({
        data: {
          slug: dto.slug,
          type: dto.type,
          location: dto.location ?? null,
          isRemote: dto.isRemote ?? false,
          isOpen: dto.isOpen ?? true,
          applyEmail: dto.applyEmail ?? null,
          closesAt: dto.closesAt ?? null,
          translations: {
            create: dto.translations.map((t) => ({
              locale: t.locale,
              title: t.title,
              body: t.body,
            })),
          },
        },
        include: { translations: true },
      });

      await this.audit(actor, 'job.create', created.id, { slug: dto.slug });
      return created;
    } catch (err) {
      if (prismaCode(err) === 'P2002') {
        throw new ConflictException(`Job posting with slug "${dto.slug}" already exists`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateJobDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.jobPosting.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!existing) throw new NotFoundException('Job posting not found');

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.jobPosting.update({
          where: { id },
          data: {
            ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
            ...(dto.type !== undefined ? { type: dto.type } : {}),
            ...(dto.location !== undefined ? { location: dto.location } : {}),
            ...(dto.isRemote !== undefined ? { isRemote: dto.isRemote } : {}),
            ...(dto.isOpen !== undefined ? { isOpen: dto.isOpen } : {}),
            ...(dto.applyEmail !== undefined ? { applyEmail: dto.applyEmail } : {}),
            ...(dto.closesAt !== undefined ? { closesAt: dto.closesAt } : {}),
          },
        });

        if (dto.translations) {
          const existingLocales = new Set(existing.translations.map((t) => t.locale));
          for (const t of dto.translations) {
            if (existingLocales.has(t.locale)) {
              await tx.jobPostingTranslation.update({
                where: { jobId_locale: { jobId: id, locale: t.locale } },
                data: { title: t.title, body: t.body },
              });
            } else {
              await tx.jobPostingTranslation.create({
                data: {
                  jobId: id,
                  locale: t.locale,
                  title: t.title,
                  body: t.body,
                },
              });
            }
          }
        }

        return tx.jobPosting.findUnique({
          where: { id },
          include: { translations: true },
        });
      });

      await this.audit(actor, 'job.update', id, { slug: dto.slug ?? existing.slug });
      return updated;
    } catch (err) {
      if (prismaCode(err) === 'P2002') {
        throw new ConflictException(`Job posting slug already in use`);
      }
      throw err;
    }
  }

  async updateStatus(id: string, dto: UpdateJobStatusDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.jobPosting.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job posting not found');

    const updated = await this.prisma.jobPosting.update({
      where: { id },
      data: { isOpen: dto.isOpen },
      include: { translations: true },
    });

    await this.audit(actor, 'job.status_change', id, { isOpen: dto.isOpen });
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.jobPosting.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Job posting not found');

    await this.prisma.jobPosting.delete({ where: { id } });
    await this.audit(actor, 'job.delete', id, { slug: existing.slug });
  }

  private async audit(
    actor: AuthenticatedUser,
    action: string,
    entityId: string,
    diff?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action,
          entityType: 'job_posting',
          entityId,
          diff: (diff ?? {}) as never,
        },
      });
    } catch (err) {
      this.logger.error(`Audit log failed for ${action}: ${(err as Error).message}`);
    }
  }
}
