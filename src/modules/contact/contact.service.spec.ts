import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ContactService } from './contact.service';
import { MailService } from '../../common/mail/mail.service';

describe('ContactService', () => {
  const prisma = {
    lead: { create: jest.fn() },
  };
  const mail: jest.Mocked<Partial<MailService>> = {
    notifyNewLead: jest.fn().mockResolvedValue(true),
    sendCustomerConfirmation: jest.fn().mockResolvedValue(true),
  };
  const service = new ContactService(prisma as unknown as PrismaService, mail as MailService);

  beforeEach(() => jest.clearAllMocks());

  it('requires explicit affirmative contact consent', async () => {
    await expect(
      service.create({
        name: 'Rahim Uddin',
        email: 'rahim@example.com',
        message: 'Please contact me about a website.',
        consentGiven: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(mail.notifyNewLead).not.toHaveBeenCalled();
  });

  it('records server-side consent time and uses the Lead model contract', async () => {
    prisma.lead.create.mockResolvedValue({});
    const res = await service.create({
      name: 'Rahim Uddin',
      email: 'rahim@example.com',
      subject: 'Website quote',
      message: 'Please contact me about a website.',
      consentGiven: true,
    });
    expect(res).toMatchObject({
      message: 'Thank you for contacting us. We will get back to you soon.',
    });
    const input = prisma.lead.create.mock.calls[0][0].data;
    expect(input).toMatchObject({
      ref: expect.stringMatching(/^LD-\d{8}-[0-9A-F]{12}$/),
      type: 'GENERAL',
      name: 'Rahim Uddin',
      email: 'rahim@example.com',
      payload: { subject: 'Website quote' },
    });
    expect(input.consentAt).toBeInstanceOf(Date);
    expect(mail.notifyNewLead).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Rahim Uddin',
        email: 'rahim@example.com',
        type: 'GENERAL',
      }),
    );
    expect(mail.sendCustomerConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Rahim Uddin',
        email: 'rahim@example.com',
      }),
    );
  });

  it('preserves lead persistence and returns success even if email dispatch fails', async () => {
    prisma.lead.create.mockResolvedValue({});
    mail.notifyNewLead = jest.fn().mockResolvedValue(false);
    mail.sendCustomerConfirmation = jest.fn().mockResolvedValue(false);

    const res = await service.create({
      name: 'Rahim Uddin',
      email: 'rahim@example.com',
      message: 'Please contact me.',
      consentGiven: true,
    });

    expect(prisma.lead.create).toHaveBeenCalled();
    expect(res.message).toContain('Thank you for contacting us');
  });

  it('handles project lead creation with qualification payload and PROJECT type', async () => {
    prisma.lead.create.mockResolvedValue({});
    mail.notifyNewLead = jest.fn().mockResolvedValue(true);
    mail.sendCustomerConfirmation = jest.fn().mockResolvedValue(true);

    const res = await service.createProjectLead({
      name: 'Karim Ahmed',
      email: 'karim@example.com',
      phone: '+8801700000000',
      company: 'Acme Corp',
      serviceInterested: 'Custom Software',
      budgetRange: '$10k-$25k',
      timeline: '3 months',
      message: 'Need enterprise ERP system',
      consentGiven: true,
    });

    expect(res.message).toContain('Thank you for your project inquiry');
    expect(res.ref).toMatch(/^LD-\d{8}-[0-9A-F]{12}$/);
    const input = prisma.lead.create.mock.calls[0][0].data;
    expect(input).toMatchObject({
      type: 'PROJECT',
      name: 'Karim Ahmed',
      email: 'karim@example.com',
      phone: '+8801700000000',
      company: 'Acme Corp',
      payload: {
        serviceInterested: 'Custom Software',
        budgetRange: '$10k-$25k',
        timeline: '3 months',
      },
    });
    expect(mail.notifyNewLead).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PROJECT_PROPOSAL',
        name: 'Karim Ahmed',
      }),
    );
  });
});
