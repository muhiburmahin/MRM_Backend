import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EmploymentType } from '@prisma/client';
import { CareersService } from './careers.service';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

type MockPrisma = {
  jobPosting: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  jobPostingTranslation: {
    create: jest.Mock;
    update: jest.Mock;
  };
  lead: {
    create: jest.Mock;
  };
  auditLog: {
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('CareersService', () => {
  let prisma: MockPrisma;

  const mail: jest.Mocked<Partial<MailService>> = {
    notifyNewLead: jest.fn().mockResolvedValue(true),
    sendCustomerConfirmation: jest.fn().mockResolvedValue(true),
  };

  const adminActor: AuthenticatedUser = {
    id: 'admin-1',
    sessionId: 's-1',
    email: 'admin@mrminfotech.com',
    name: 'Admin',
    uiLocale: 'en',
    mustChangePassword: false,
    twoFactorEnabled: false,
    role: { id: 'r-1', key: 'admin', name: 'Administrator' },
    permissions: ['content:read', 'content:write', 'content:publish', 'content:delete'],
  };

  let service: CareersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      jobPosting: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      jobPostingTranslation: {
        create: jest.fn(),
        update: jest.fn(),
      },
      lead: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    service = new CareersService(
      prisma as unknown as PrismaService,
      mail as unknown as MailService,
    );
  });

  describe('listPublic', () => {
    it('returns formatted open jobs and pagination metadata', async () => {
      prisma.jobPosting.count.mockResolvedValue(1);
      prisma.jobPosting.findMany.mockResolvedValue([
        {
          slug: 'lead-architect',
          type: EmploymentType.FULL_TIME,
          location: 'Dhaka',
          isRemote: true,
          isOpen: true,
          closesAt: null,
          createdAt: new Date(),
          translations: [{ title: 'Lead Architect' }],
        },
      ]);

      const result = await service.listPublic({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Lead Architect');
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });
  });

  describe('getBySlugPublic', () => {
    it('throws 404 when job does not exist or is closed', async () => {
      prisma.jobPosting.findFirst.mockResolvedValue(null);
      await expect(service.getBySlugPublic('not-found')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns job detail with requested translation', async () => {
      prisma.jobPosting.findFirst.mockResolvedValue({
        slug: 'lead-architect',
        type: EmploymentType.FULL_TIME,
        location: 'Dhaka',
        isRemote: true,
        isOpen: true,
        applyEmail: 'jobs@mrm.com',
        closesAt: null,
        createdAt: new Date(),
        translations: [
          { locale: 'en', title: 'Lead Architect', body: 'We are looking for a lead architect...' },
        ],
      });

      const result = await service.getBySlugPublic('lead-architect', 'en');
      expect(result.slug).toBe('lead-architect');
      expect(result.title).toBe('Lead Architect');
      expect(result.availableLocales).toEqual(['en']);
    });
  });

  describe('apply', () => {
    it('requires explicit consent', async () => {
      await expect(
        service.apply('lead-architect', {
          name: 'Rahim',
          email: 'rahim@example.com',
          consentGiven: false,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a Lead record and sends notifications', async () => {
      prisma.jobPosting.findFirst.mockResolvedValue({
        id: 'job-1',
        slug: 'lead-architect',
        applyEmail: 'jobs@mrm.com',
      });
      prisma.lead.create.mockResolvedValue({});

      const result = await service.apply('lead-architect', {
        name: 'Rahim',
        email: 'rahim@example.com',
        phone: '+8801700000000',
        resumeUrl: 'https://linkedin.com/in/rahim',
        coverLetter: 'I would like to apply.',
        consentGiven: true,
      });

      expect(result.message).toContain('Application submitted successfully');
      expect(prisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'GENERAL',
            name: 'Rahim',
            email: 'rahim@example.com',
            payload: expect.objectContaining({
              kind: 'CAREER_APPLICATION',
              jobSlug: 'lead-architect',
            }),
          }),
        }),
      );
      expect(mail.notifyNewLead).toHaveBeenCalled();
      expect(mail.sendCustomerConfirmation).toHaveBeenCalled();
    });
  });

  describe('create and update', () => {
    it('creates a job posting with translations', async () => {
      prisma.jobPosting.create.mockResolvedValue({
        id: 'job-1',
        slug: 'frontend-engineer',
        type: EmploymentType.FULL_TIME,
        translations: [{ locale: 'en', title: 'Frontend Engineer', body: 'Vue / React' }],
      });

      const created = await service.create(
        {
          slug: 'frontend-engineer',
          type: EmploymentType.FULL_TIME,
          translations: [{ locale: 'en', title: 'Frontend Engineer', body: 'Vue / React' }],
        },
        adminActor,
      );

      expect(created.slug).toBe('frontend-engineer');
      expect(prisma.jobPosting.create).toHaveBeenCalled();
    });

    it('maps unique constraint to ConflictException on create', async () => {
      prisma.jobPosting.create.mockRejectedValue({ code: 'P2002' });
      await expect(
        service.create(
          {
            slug: 'frontend-engineer',
            type: EmploymentType.FULL_TIME,
            translations: [{ locale: 'en', title: 'Frontend Engineer', body: 'Vue / React' }],
          },
          adminActor,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('updates status and logs audit', async () => {
      prisma.jobPosting.findUnique.mockResolvedValue({ id: 'job-1', isOpen: true });
      prisma.jobPosting.update.mockResolvedValue({ id: 'job-1', isOpen: false });

      const updated = await service.updateStatus('job-1', { isOpen: false }, adminActor);
      expect(updated.isOpen).toBe(false);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });
});
