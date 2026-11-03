import { PrismaClient } from '@prisma/client';

type PermissionSeed = {
  key: string;
  group: string;
  description: string;
};

const prisma = new PrismaClient();

const contentScopes = ['page', 'product', 'service', 'post', 'casestudy'] as const;
const contentActions = ['read', 'write', 'publish', 'delete'] as const;

function scopedPermissions(
  scope: string,
  group: string,
  actions: readonly string[],
): PermissionSeed[] {
  return actions.map((action) => ({
    key: `${scope}:${action}`,
    group,
    description: `${action} ${scope} content`,
  }));
}

const permissions: PermissionSeed[] = [
  ...scopedPermissions('content', 'content', contentActions),
  ...contentScopes.flatMap((scope) => scopedPermissions(scope, 'content', contentActions)),
  { key: 'media:upload', group: 'media', description: 'Upload media assets' },
  { key: 'media:delete', group: 'media', description: 'Delete media assets' },
  { key: 'nav:write', group: 'site', description: 'Manage navigation menus' },
  { key: 'theme:write', group: 'site', description: 'Manage themes' },
  { key: 'theme:publish', group: 'site', description: 'Publish themes' },
  { key: 'settings:write', group: 'site', description: 'Manage site settings' },
  { key: 'lead:read', group: 'leads', description: 'View leads' },
  { key: 'lead:write', group: 'leads', description: 'Manage leads' },
  { key: 'lead:export', group: 'leads', description: 'Export leads' },
  { key: 'lead:delete', group: 'leads', description: 'Delete leads' },
  { key: 'subscriber:read', group: 'leads', description: 'View subscribers' },
  { key: 'subscriber:export', group: 'leads', description: 'Export subscribers' },
  { key: 'user:read', group: 'users', description: 'View users' },
  { key: 'user:invite', group: 'users', description: 'Invite users' },
  { key: 'user:write', group: 'users', description: 'Manage users' },
  { key: 'user:delete', group: 'users', description: 'Delete users' },
  { key: 'role:write', group: 'users', description: 'Manage roles and role permissions' },
  { key: 'audit:read', group: 'audit', description: 'View audit logs' },
  { key: 'form:write', group: 'leads', description: 'Manage form definitions' },
  {
    key: 'email_template:write',
    group: 'communications',
    description: 'Manage email templates',
  },
  { key: 'redirect:write', group: 'site', description: 'Manage redirects' },
  { key: 'announcement:write', group: 'site', description: 'Manage announcements' },
];

const allPermissionKeys = permissions.map(({ key }) => key);
const publicContentReadKeys = ['content:read', ...contentScopes.map((scope) => `${scope}:read`)];
const editorPermissionKeys = [
  'content:read',
  'content:write',
  'content:publish',
  ...contentScopes.flatMap((scope) =>
    ['read', 'write', 'publish'].map((action) => `${scope}:${action}`),
  ),
  'media:upload',
  'nav:write',
];

const roles = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full system access.',
    permissionKeys: allPermissionKeys,
  },
  {
    key: 'admin',
    name: 'Administrator',
    description: 'Administrative access without role management or user deletion.',
    permissionKeys: allPermissionKeys.filter(
      (key) => key !== 'user:delete' && key !== 'role:write',
    ),
  },
  {
    key: 'editor',
    name: 'Editor',
    description: 'Create and publish content without access to private lead or user data.',
    permissionKeys: editorPermissionKeys,
  },
  {
    key: 'sales',
    name: 'Sales',
    description: 'Work with leads and view site content.',
    permissionKeys: ['content:read', 'lead:read', 'lead:write', 'subscriber:read'],
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read published-content areas only; no private lead or user data.',
    permissionKeys: publicContentReadKeys,
  },
] as const;

async function seedSystemData(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.language.updateMany({
      where: { isDefault: true, code: { not: 'en' } },
      data: { isDefault: false },
    });
    await tx.language.upsert({
      where: { code: 'en' },
      update: { name: 'English', isDefault: true, isEnabled: true, rtl: false, sortOrder: 0 },
      create: { code: 'en', name: 'English', isDefault: true, isEnabled: true, rtl: false },
    });
    await tx.language.upsert({
      where: { code: 'bn' },
      update: { name: 'বাংলা', isDefault: false, isEnabled: true, rtl: false, sortOrder: 1 },
      create: {
        code: 'bn',
        name: 'বাংলা',
        isDefault: false,
        isEnabled: true,
        rtl: false,
        sortOrder: 1,
      },
    });

    const permissionIds = new Map<string, string>();
    for (const permission of permissions) {
      const saved = await tx.permission.upsert({
        where: { key: permission.key },
        update: { group: permission.group, description: permission.description },
        create: permission,
      });
      permissionIds.set(permission.key, saved.id);
    }

    const roleIds = new Map<string, string>();
    for (const role of roles) {
      const saved = await tx.role.upsert({
        where: { key: role.key },
        update: { name: role.name, description: role.description, isSystem: true },
        create: { key: role.key, name: role.name, description: role.description, isSystem: true },
      });
      roleIds.set(role.key, saved.id);
    }

    for (const role of roles) {
      const roleId = roleIds.get(role.key);
      if (!roleId) throw new Error(`Seed role was not persisted: ${role.key}`);
      const data = role.permissionKeys.map((key) => {
        const permissionId = permissionIds.get(key);
        if (!permissionId) throw new Error(`Seed permission was not persisted: ${key}`);
        return { roleId, permissionId };
      });
      await tx.rolePermission.createMany({ data, skipDuplicates: true });

      const existingGrants = await tx.rolePermission.findMany({
        where: { roleId },
        select: { permission: { select: { key: true } } },
      });
      const allowedKeys = new Set<string>(role.permissionKeys);
      const unexpectedKeys = existingGrants
        .map(({ permission }) => permission.key)
        .filter((key) => !allowedKeys.has(key));
      if (unexpectedKeys.length > 0) {
        throw new Error(
          `Role ${role.key} has grants outside the seed policy; review and revoke them explicitly: ${unexpectedKeys.join(', ')}`,
        );
      }
    }

    for (const key of ['header', 'footer-company', 'footer-legal']) {
      await tx.navMenu.upsert({ where: { key }, update: {}, create: { key } });
    }

    // Seed MRM InfoTech Core Company Profile
    await tx.siteSetting.upsert({
      where: { key: 'company.profile' },
      update: {
        group: 'company',
        isPublic: true,
        value: {
          name: 'MRM InfoTech',
          legalName: 'MRM InfoTech Ltd.',
          tagline: 'IDEAS • PRODUCTS • IMPACT',
          email: 'contact@mrminfotech.com',
          phone: '+8801700000000',
          website: 'https://mrminfotech.com',
          description:
            'Leading software architecture and enterprise technology provider delivering scalable digital products and custom engineering solutions.',
          headquarters: 'Dhaka, Bangladesh',
          foundedYear: 2024,
        },
      },
      create: {
        key: 'company.profile',
        group: 'company',
        isPublic: true,
        value: {
          name: 'MRM InfoTech',
          legalName: 'MRM InfoTech Ltd.',
          tagline: 'IDEAS • PRODUCTS • IMPACT',
          email: 'contact@mrminfotech.com',
          phone: '+8801700000000',
          website: 'https://mrminfotech.com',
          description:
            'Leading software architecture and enterprise technology provider delivering scalable digital products and custom engineering solutions.',
          headquarters: 'Dhaka, Bangladesh',
          foundedYear: 2024,
        },
      },
    });

    // Seed 3 Core Products
    const products = [
      {
        slug: 'edumanage-bd',
        stage: 'LIVE' as const,
        isFeatured: true,
        sortOrder: 1,
        name: 'EduManage BD',
        tagline: 'Comprehensive School & University ERP',
        summary:
          'Cloud-native educational management ecosystem designed for Bangladeshi schools, colleges, and universities.',
      },
      {
        slug: 'medisheba-bd',
        stage: 'LIVE' as const,
        isFeatured: true,
        sortOrder: 2,
        name: 'MediSheba BD',
        tagline: 'Integrated Clinical & Diagnostic Management',
        summary:
          'Secure healthcare management system connecting clinics, diagnostic centers, doctors, and patients.',
      },
      {
        slug: 'multi-institution-platform',
        stage: 'BETA' as const,
        isFeatured: true,
        sortOrder: 3,
        name: 'Multi-Institution Platform',
        tagline: 'Enterprise Multi-Tenant SaaS Engine',
        summary:
          'Scalable multi-tenant governance platform engineered for chain institutions, enterprises, and conglomerates.',
      },
    ];

    for (const prod of products) {
      const p = await tx.product.upsert({
        where: { slug: prod.slug },
        update: { stage: prod.stage, isFeatured: prod.isFeatured, sortOrder: prod.sortOrder },
        create: {
          slug: prod.slug,
          stage: prod.stage,
          isFeatured: prod.isFeatured,
          sortOrder: prod.sortOrder,
        },
      });

      await tx.productTranslation.upsert({
        where: { productId_locale: { productId: p.id, locale: 'en' } },
        update: {
          name: prod.name,
          tagline: prod.tagline,
          summary: prod.summary,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
        create: {
          productId: p.id,
          locale: 'en',
          name: prod.name,
          tagline: prod.tagline,
          summary: prod.summary,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
    }

    // Seed 14 Core Client Services
    const services = [
      {
        slug: 'custom-software-development',
        name: 'Custom Software Development',
        summary: 'Tailor-made software solutions designed to solve complex business problems.',
        sortOrder: 1,
      },
      {
        slug: 'web-application-development',
        name: 'Web Application Development',
        summary: 'High-performance, secure, and scalable web apps built with modern tech stacks.',
        sortOrder: 2,
      },
      {
        slug: 'mobile-app-development',
        name: 'Mobile App Development',
        summary: 'Native and cross-platform mobile apps for iOS and Android devices.',
        sortOrder: 3,
      },
      {
        slug: 'enterprise-erp-solutions',
        name: 'Enterprise ERP Solutions',
        summary: 'Modular, integrated ERP software streamlining organizational operations.',
        sortOrder: 4,
      },
      {
        slug: 'cloud-devops-infrastructure',
        name: 'Cloud & DevOps Infrastructure',
        summary: 'Resilient cloud architecture, CI/CD automation, and Kubernetes orchestration.',
        sortOrder: 5,
      },
      {
        slug: 'ai-machine-learning-solutions',
        name: 'AI & Machine Learning Solutions',
        summary: 'Intelligent automation, predictive models, and LLM integrations.',
        sortOrder: 6,
      },
      {
        slug: 'ui-ux-design',
        name: 'UI/UX Design & Prototyping',
        summary: 'User-centric product design, wireframing, and interactive digital interfaces.',
        sortOrder: 7,
      },
      {
        slug: 'cybersecurity-compliance',
        name: 'Cybersecurity & Compliance',
        summary: 'Vulnerability assessment, penetration testing, and security auditing.',
        sortOrder: 8,
      },
      {
        slug: 'database-architecture-migration',
        name: 'Database Architecture & Migration',
        summary: 'High-availability database design, optimization, and seamless cloud migration.',
        sortOrder: 9,
      },
      {
        slug: 'ecommerce-fintech-platforms',
        name: 'E-Commerce & FinTech Platforms',
        summary: 'Secure payment gateway integrations, checkout engines, and commerce portals.',
        sortOrder: 10,
      },
      {
        slug: 'api-microservices-architecture',
        name: 'API & Microservices Architecture',
        summary: 'Decoupled, event-driven microservices with robust REST & GraphQL APIs.',
        sortOrder: 11,
      },
      {
        slug: 'edtech-academic-systems',
        name: 'EdTech & Academic Systems',
        summary: 'Specialized portals and learning management systems for academic bodies.',
        sortOrder: 12,
      },
      {
        slug: 'healthcare-telemedicine-systems',
        name: 'Healthcare & Telemedicine Systems',
        summary: 'EMR, EHR, and telemedicine platforms compliant with health data standards.',
        sortOrder: 13,
      },
      {
        slug: 'it-consulting-digital-transformation',
        name: 'IT Consulting & Digital Transformation',
        summary: 'Strategic technology advisory guiding modernization and tech adoption.',
        sortOrder: 14,
      },
    ];

    for (const s of services) {
      const createdService = await tx.service.upsert({
        where: { slug: s.slug },
        update: { sortOrder: s.sortOrder, isActive: true },
        create: { slug: s.slug, sortOrder: s.sortOrder, isActive: true },
      });

      await tx.serviceTranslation.upsert({
        where: { serviceId_locale: { serviceId: createdService.id, locale: 'en' } },
        update: {
          name: s.name,
          summary: s.summary,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
        create: {
          serviceId: createdService.id,
          locale: 'en',
          name: s.name,
          summary: s.summary,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
    }
  });
}

async function main(): Promise<void> {
  try {
    await seedSystemData();
    process.stdout.write('System data seed completed.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const detail =
    error instanceof Error ? (error.stack ?? error.message) : `Unknown error: ${String(error)}`;
  process.stderr.write(`System data seed failed:\n${detail}\n`);
  process.exitCode = 1;
});
