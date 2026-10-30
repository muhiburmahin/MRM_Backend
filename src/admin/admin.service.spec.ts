import { AdminService } from './admin.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

describe('AdminService', () => {
  const prisma = {
    lead: { count: jest.fn() },
    product: { count: jest.fn() },
    post: { count: jest.fn() },
    service: { count: jest.fn() },
    caseStudy: { count: jest.fn() },
    teamMember: { count: jest.fn() },
    faq: { count: jest.fn() },
    testimonial: { count: jest.fn() },
    mediaAsset: { count: jest.fn() },
    user: { count: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    [
      prisma.lead.count,
      prisma.lead.count,
      prisma.product.count,
      prisma.product.count,
      prisma.post.count,
      prisma.post.count,
      prisma.service.count,
      prisma.service.count,
      prisma.caseStudy.count,
      prisma.caseStudy.count,
      prisma.teamMember.count,
      prisma.faq.count,
      prisma.faq.count,
      prisma.testimonial.count,
      prisma.testimonial.count,
      prisma.mediaAsset.count,
      prisma.user.count,
      prisma.user.count,
    ].forEach((count, index) => count.mockResolvedValueOnce(index + 1));
    prisma.$transaction.mockImplementation((queries: Promise<number>[]) => Promise.all(queries));
  });

  it('returns dashboard counts using the current schema models', async () => {
    const service = new AdminService(prisma as never);

    await expect(service.getDashboard()).resolves.toMatchObject({
      leads: { total: 1, new: 2 },
      products: { total: 3, published: 4 },
      blogPosts: { total: 5, published: 6 },
      services: { total: 7, published: 8 },
      projects: { total: 9, published: 10 },
      teamMembers: { total: 11 },
      faqs: { total: 12, published: 13 },
      testimonials: { total: 14, published: 15 },
      media: { total: 16 },
      users: { total: 17, active: 18 },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.lead.count).toHaveBeenNthCalledWith(1, { where: { deletedAt: null } });
    expect(prisma.lead.count).toHaveBeenNthCalledWith(2, {
      where: { deletedAt: null, status: 'NEW' },
    });
    expect(prisma.product.count).toHaveBeenNthCalledWith(2, {
      where: {
        translations: {
          some: {
            status: 'PUBLISHED',
            publishedAt: { not: null, lte: expect.any(Date) },
          },
        },
      },
    });
    expect(prisma.caseStudy.count).toHaveBeenNthCalledWith(2, {
      where: {
        isVerified: true,
        evidenceNote: { not: null, notIn: [''] },
        publishedAt: { not: null, lte: expect.any(Date) },
        translations: { some: { status: 'PUBLISHED' } },
      },
    });
    expect(prisma.testimonial.count).toHaveBeenNthCalledWith(2, {
      where: {
        showOnSite: true,
        isVerified: true,
        evidenceNote: { not: null, notIn: [''] },
        consentAt: { not: null },
      },
    });
  });

  it('builds the admin profile from the authenticated session identity only', () => {
    const user: AuthenticatedUser = {
      id: 'user-id',
      sessionId: 'session-id',
      email: 'admin@example.com',
      name: 'Admin',
      uiLocale: 'en',
      mustChangePassword: false,
      twoFactorEnabled: false,
      role: { id: 'role-id', key: 'admin', name: 'Administrator' },
      permissions: ['user:read'],
    };

    expect(new AdminService(prisma as never).getProfile(user)).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      uiLocale: user.uiLocale,
      role: { key: 'admin', name: 'Administrator' },
      permissions: ['user:read'],
      mustChangePassword: false,
    });
  });
});
