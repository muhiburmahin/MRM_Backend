import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateContactDto } from './dto/create-contact.dto';
import { StartProjectDto } from './dto/start-project.dto';
import { QueryContactDto } from './dto/query-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

const leadSelect = {
  id: true,
  ref: true,
  type: true,
  status: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  country: true,
  message: true,
  payload: true,
  locale: true,
  landingPath: true,
  createdAt: true,
  updatedAt: true,
  consentAt: true,
  policyId: true,
  assignedToId: true,
  firstContactedAt: true,
  changes: { select: { from: true, to: true, createdAt: true } },
} satisfies Prisma.LeadSelect;

const detailsSelect = {
  ...leadSelect,
  notes: {
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.LeadSelect;

const prismaCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async create(dto: CreateContactDto) {
    if (dto.consentGiven !== true) {
      throw new BadRequestException('Consent to be contacted is required');
    }
    const timestamp = new Date();
    const datePart = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
    const ref = `LD-${datePart}-${randomBytes(6).toString('hex').toUpperCase()}`;

    try {
      await this.prisma.lead.create({
        data: {
          ref,
          type: 'GENERAL',
          name: dto.name,
          email: dto.email,
          phone: dto.phone ?? null,
          message: dto.message,
          ...(dto.subject ? { payload: { subject: dto.subject } as never } : {}),
          consentAt: timestamp,
        },
      });
    } catch {
      this.logger.error('Failed to save contact submission');
      throw new InternalServerErrorException(
        'Could not submit your message. Please try again later.',
      );
    }

    // Trigger asynchronous, non-blocking email notifications
    // Even if email delivery fails, the lead record remains preserved in the database.
    await this.mail.notifyNewLead({
      ref,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      subject: dto.subject,
      message: dto.message,
      type: 'GENERAL_INQUIRY',
    });
    await this.mail.sendCustomerConfirmation({
      ref,
      name: dto.name,
      email: dto.email,
    });

    return {
      message: 'Thank you for contacting us. We will get back to you soon.',
      ref,
      referenceNumber: ref,
    };
  }

  async createProjectLead(dto: StartProjectDto) {
    if (dto.consentGiven !== true) {
      throw new BadRequestException('Consent to be contacted is required');
    }
    const timestamp = new Date();
    const datePart = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
    const ref = `LD-${datePart}-${randomBytes(6).toString('hex').toUpperCase()}`;

    let serviceId: string | undefined = undefined;
    if (dto.serviceInterested) {
      try {
        const matchedService = await this.prisma.service.findFirst({
          where: {
            OR: [
              { slug: dto.serviceInterested },
              { id: dto.serviceInterested.length === 36 ? dto.serviceInterested : undefined },
            ],
          },
          select: { id: true },
        });
        if (matchedService) serviceId = matchedService.id;
      } catch {
        // Continue even if lookup fails
      }
    }

    try {
      await this.prisma.lead.create({
        data: {
          ref,
          type: 'PROJECT',
          status: 'NEW',
          name: dto.name,
          email: dto.email,
          phone: dto.phone ?? null,
          company: dto.company ?? null,
          message: dto.message,
          serviceId,
          payload: {
            serviceInterested: dto.serviceInterested ?? null,
            budgetRange: dto.budgetRange ?? null,
            timeline: dto.timeline ?? null,
          } as never,
          consentAt: timestamp,
        },
      });
    } catch {
      this.logger.error('Failed to save project lead submission');
      throw new InternalServerErrorException(
        'Could not submit your project inquiry. Please try again later.',
      );
    }

    await this.mail.notifyNewLead({
      ref,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      company: dto.company,
      subject: dto.serviceInterested ? `Service: ${dto.serviceInterested}` : 'Project Proposal',
      message: `${dto.message}\n\nBudget: ${dto.budgetRange || 'Not specified'}\nTimeline: ${dto.timeline || 'Not specified'}`,
      type: 'PROJECT_PROPOSAL',
    });
    await this.mail.sendCustomerConfirmation({
      ref,
      name: dto.name,
      email: dto.email,
    });

    return {
      message:
        'Thank you for your project inquiry. Our team will review your requirements and reach out shortly.',
      ref,
      referenceNumber: ref,
    };
  }

  async findAll(q: QueryContactDto) {
    const where: Prisma.LeadWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { company: { contains: q.search, mode: 'insensitive' } },
              { message: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      deletedAt: null,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        select: leadSelect,
        orderBy: { [q.sortBy]: q.order },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.lead.count({ where }),
    ]);
    return {
      data: items,
      meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    };
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null },
      select: detailsSelect,
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(id: string, dto: UpdateContactDto, actor: AuthenticatedUser) {
    const current = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!current) throw new NotFoundException('Lead not found');
    if (
      dto.status === undefined &&
      dto.assignedToId === undefined &&
      dto.internalNote === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id },
          data: {
            ...(dto.status === undefined ? {} : { status: dto.status }),
            ...(dto.assignedToId === undefined ? {} : { assignedToId: dto.assignedToId }),
          },
        });
        if (dto.status !== undefined && dto.status !== current.status) {
          await tx.leadStatusChange.create({
            data: { leadId: id, from: current.status, to: dto.status, byId: actor.id },
          });
        }
        if (dto.internalNote?.trim()) {
          await tx.leadNote.create({
            data: { leadId: id, authorId: actor.id, body: dto.internalNote.trim() },
          });
        }
      });
    } catch (error) {
      if (prismaCode(error) === 'P2003') {
        throw new BadRequestException('The selected assignee does not exist');
      }
      throw error;
    }
    return this.findOne(id);
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const current = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('Lead not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'lead.delete',
          entityType: 'lead',
          entityId: id,
          diff: { softDeleted: true } as never,
        },
      });
    });
  }
}
