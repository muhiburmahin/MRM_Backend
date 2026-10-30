import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthUserResponse } from '../auth/dto/auth-user.response';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  getProfile(user: AuthenticatedUser): AuthUserResponse {
    return AuthUserResponse.from(user);
  }

  async getDashboard() {
    const now = new Date();
    const [
      leadsTotal,
      leadsNew,
      productsTotal,
      productsPublished,
      postsTotal,
      postsPublished,
      servicesTotal,
      servicesPublished,
      projectsTotal,
      projectsPublished,
      teamTotal,
      faqsTotal,
      faqsPublished,
      testimonialsTotal,
      testimonialsPublished,
      mediaTotal,
      usersTotal,
      usersActive,
    ] = await this.prisma.$transaction([
      this.prisma.lead.count({ where: { deletedAt: null } }),
      this.prisma.lead.count({ where: { deletedAt: null, status: 'NEW' } }),
      this.prisma.product.count(),
      this.prisma.product.count({
        where: {
          translations: {
            some: { status: 'PUBLISHED', publishedAt: { not: null, lte: now } },
          },
        },
      }),
      this.prisma.post.count(),
      this.prisma.post.count({
        where: {
          translations: {
            some: { status: 'PUBLISHED', publishedAt: { not: null, lte: now } },
          },
        },
      }),
      this.prisma.service.count(),
      this.prisma.service.count({
        where: {
          translations: {
            some: { status: 'PUBLISHED', publishedAt: { not: null, lte: now } },
          },
        },
      }),
      this.prisma.caseStudy.count(),
      this.prisma.caseStudy.count({
        where: {
          isVerified: true,
          evidenceNote: { not: null, notIn: [''] },
          publishedAt: { not: null, lte: now },
          translations: { some: { status: 'PUBLISHED' } },
        },
      }),
      this.prisma.teamMember.count(),
      this.prisma.faq.count(),
      this.prisma.faq.count({ where: { isPublished: true } }),
      this.prisma.testimonial.count(),
      this.prisma.testimonial.count({
        where: {
          showOnSite: true,
          isVerified: true,
          evidenceNote: { not: null, notIn: [''] },
          consentAt: { not: null },
        },
      }),
      this.prisma.mediaAsset.count(),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      leads: { total: leadsTotal, new: leadsNew },
      products: { total: productsTotal, published: productsPublished },
      blogPosts: { total: postsTotal, published: postsPublished },
      services: { total: servicesTotal, published: servicesPublished },
      projects: { total: projectsTotal, published: projectsPublished },
      teamMembers: { total: teamTotal },
      faqs: { total: faqsTotal, published: faqsPublished },
      testimonials: { total: testimonialsTotal, published: testimonialsPublished },
      media: { total: mediaTotal },
      users: { total: usersTotal, active: usersActive },
    };
  }
}
