import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  const prisma = {
    lead: { create: jest.fn() },
  };
  const service = new ContactService(prisma as unknown as PrismaService);

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
  });

  it('records server-side consent time and uses the Lead model contract', async () => {
    prisma.lead.create.mockResolvedValue({});
    await service.create({
      name: 'Rahim Uddin',
      email: 'rahim@example.com',
      subject: 'Website quote',
      message: 'Please contact me about a website.',
      consentGiven: true,
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
    expect(prisma.lead.create.mock.calls[0][0].data).not.toHaveProperty('status');
  });
});
