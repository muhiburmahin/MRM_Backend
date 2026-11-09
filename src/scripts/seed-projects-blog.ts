import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedProjectsAndBlog() {
  console.log('Seeding Projects / Case Studies...');

  // Get products to link
  const eduManageProduct = await prisma.product.findUnique({ where: { slug: 'edumanage-bd' } });
  const mediShebaProduct = await prisma.product.findUnique({ where: { slug: 'medisheba-bd' } });
  const multiInstProduct = await prisma.product.findUnique({
    where: { slug: 'multi-institution-platform' },
  });
  const customDevService = await prisma.service.findFirst({
    where: { slug: { contains: 'custom-software' } },
  });
  const webDevService = await prisma.service.findFirst({ where: { slug: { contains: 'web' } } });

  const projectsToSeed = [
    {
      slug: 'edumanage-bd-campus-cloud',
      sortOrder: 1,
      projectWorkStatus: 'COMPLETED',
      isFeatured: true,
      isVerified: true,
      evidenceNote:
        'Verified deployment across 15+ educational campuses with active fee reconciliation.',
      publishedAt: new Date('2026-01-15T00:00:00.000Z'),
      clientApprovedAt: new Date('2026-01-15T00:00:00.000Z'),
      productId: eduManageProduct?.id || null,
      serviceId: customDevService?.id || null,
      liveUrl: 'https://edumanagebd.com',
      frontendRepoUrl: 'https://github.com/mrminfotech/edumanage-bd-frontend',
      backendRepoUrl: 'https://github.com/mrminfotech/edumanage-bd-backend',
      showFrontendRepo: false,
      showBackendRepo: false,
      frontendTechSummary: ['Next.js 16', 'TypeScript', 'Tailwind CSS v4', 'Lucide React'],
      backendTechSummary: ['NestJS 11', 'PostgreSQL', 'Prisma ORM', 'Redis Cache'],
      dbToolsSummary: ['PostgreSQL 16', 'Redis', 'Docker Compose', 'AWS S3'],
      metrics: [
        { label: 'Time Saved in Grading', value: '80%' },
        { label: 'Cash Leakage Reduced', value: '100%' },
        { label: 'Active Daily Students', value: '15,000+' },
        { label: 'System Uptime SLA', value: '99.95%' },
      ],
      translation: {
        title: 'EduManage BD — Campus Automation & ERP Implementation',
        summary:
          'End-to-end cloud campus operating system unifying student admissions, biometric attendance with automated SMS dispatch, and local bKash/Nagad fee reconciliation.',
        challenge:
          'Educational institutions in Bangladesh struggle with paper-based registers, physical queues for quarterly tuition fees, lost examination records, and disconnected parent communication during attendance alerts.',
        solution:
          'MRM InfoTech architected a cloud-native educational management ecosystem featuring high-concurrency fee collection, biometric telemetry integration, and automated GPA tabulation with instant parent notifications.',
        result:
          'Zero fee discrepancies recorded across 15 campuses, over 15,000 active students tracked daily, and teacher administrative workload reduced by over 80%.',
        body: `### Executive Overview
EduManage BD represents MRM InfoTech's flagship institutional modernization platform. Built specifically for schools, colleges, and madrasas in Bangladesh, it directly tackles the fragmentation of academic records, financial reconciliation, and parent communication.

### Architectural Highlights
- **Decoupled Architecture:** Next.js modern web console paired with NestJS microservices.
- **Biometric Telemetry:** Low-latency webhook integration for RFID student turnstiles.
- **Automated MFS Reconciliation:** Direct bKash and Nagad payment gateway webhooks ensuring real-time invoice settlement without human verification queues.
- **Resilient Security:** Strict Role-Based Access Control (RBAC) separating student records, financial ledgers, and exam grading.`,
        seoTitle: 'EduManage BD Case Study | Campus Automation & ERP Deployment',
        seoDescription:
          'Case study of EduManage BD by MRM InfoTech: 15,000+ active students, 80% grading time saved, and 100% digital fee reconciliation.',
      },
    },
    {
      slug: 'medisheba-bd-clinical-diagnostics',
      sortOrder: 2,
      projectWorkStatus: 'COMPLETED',
      isFeatured: true,
      isVerified: true,
      evidenceNote:
        'Verified production deployment in diagnostic clinical centers with barcode sample routing.',
      publishedAt: new Date('2026-02-10T00:00:00.000Z'),
      clientApprovedAt: new Date('2026-02-10T00:00:00.000Z'),
      productId: mediShebaProduct?.id || null,
      serviceId: customDevService?.id || null,
      liveUrl: 'https://medishebabd.com',
      frontendRepoUrl: 'https://github.com/mrminfotech/medisheba-portal',
      backendRepoUrl: 'https://github.com/mrminfotech/medisheba-api',
      showFrontendRepo: false,
      showBackendRepo: false,
      frontendTechSummary: ['React 19', 'Next.js App Router', 'Tailwind CSS', 'Framer Motion'],
      backendTechSummary: ['NestJS', 'PostgreSQL', 'Prisma', 'BullMQ Queue'],
      dbToolsSummary: ['PostgreSQL', 'Redis', 'Cloudinary Media CDN', 'MinIO'],
      metrics: [
        { label: 'Specimen Turnaround', value: '45m' },
        { label: 'Patient Report Accuracy', value: '99.9%' },
        { label: 'Diagnostic Centers Live', value: '8+' },
        { label: 'Monthly Lab Tests', value: '25,000+' },
      ],
      translation: {
        title: 'MediSheba BD — Clinical Diagnostics & Telemedicine Platform',
        summary:
          'Complete diagnostic laboratory management system with barcode specimen tracking, automated doctor report generation, and patient mobile report delivery.',
        challenge:
          'Diagnostic laboratories faced sample misplacement, slow report dispatch times, manual doctor signatures, and lack of verified patient verification leading to diagnostic errors.',
        solution:
          'Engineered a HIPAA-aligned laboratory operating system integrating automated barcode specimen printing, pre-configured diagnostic report templates, digital doctor signatures, and SMS/WhatsApp report download links.',
        result:
          'Specimen turnaround dropped to 45 minutes, laboratory errors decreased by 98%, and patient satisfaction reached an all-time high of 99.2%.',
        body: `### Clinical Transformation
MediSheba BD solves the critical bottlenecks in clinical specimen routing and patient report distribution.

### Technical Engineering
- **Barcode Telemetry:** Instant barcode generation on patient registration with thermal printer integration.
- **Digital Pathologist Signature:** Cryptographically verified digital sign-off on laboratory test results.
- **Secure CDN Delivery:** Encrypted PDF report compilation on Cloudinary CDN with expirable download URLs.`,
        seoTitle: 'MediSheba BD Case Study | Diagnostic Laboratory Management Platform',
        seoDescription:
          'How MediSheba BD streamlined clinical diagnostic workflow and report distribution across Bangladesh.',
      },
    },
    {
      slug: 'multi-institution-website-governance',
      sortOrder: 3,
      projectWorkStatus: 'COMPLETED',
      isFeatured: true,
      isVerified: true,
      evidenceNote:
        'Verified multi-tenant architecture delivering 50+ websites from a single codebase.',
      publishedAt: new Date('2026-03-01T00:00:00.000Z'),
      clientApprovedAt: new Date('2026-03-01T00:00:00.000Z'),
      productId: multiInstProduct?.id || null,
      serviceId: webDevService?.id || null,
      liveUrl: 'https://mrminfotech.com/products/multi-institution-platform',
      frontendRepoUrl: null,
      backendRepoUrl: null,
      showFrontendRepo: false,
      showBackendRepo: false,
      frontendTechSummary: ['Next.js 16 (Multi-Tenant)', 'Tailwind CSS v4', 'TypeScript'],
      backendTechSummary: ['NestJS', 'PostgreSQL', 'Redis Cluster', 'Edge DNS Routing'],
      dbToolsSummary: ['PostgreSQL 16', 'Cloudflare Workers', 'Neon DB'],
      metrics: [
        { label: 'Campuses Managed', value: '50+' },
        { label: 'Infrastructure Cost Saved', value: '65%' },
        { label: 'Deployment Time Per Site', value: '< 2min' },
        { label: 'Edge Cache Hit Rate', value: '94.2%' },
      ],
      translation: {
        title: 'Multi-Institution Website Platform — Centralized Governance',
        summary:
          'Scalable multi-tenant portal infrastructure enabling institutions and academic networks to spin up and manage independent sub-brand websites from a single control panel.',
        challenge:
          'Educational conglomerates and multi-campus networks were maintaining individual WordPress installations, leading to frequent security breaches, inconsistent branding, and astronomical maintenance costs.',
        solution:
          'Designed a centralized multi-tenant Next.js engine with dynamic subdomain and custom domain routing, granular role-based publishing, and automated SSL termination.',
        result:
          'Reduced institutional IT operational costs by 65%, eliminated security vulnerabilities across 50+ portals, and enabled new campus site provisioning in under two minutes.',
        body: `### The Governance Dilemma
Managing multiple institutional domains traditionally requires fragmented CMS installations that degrade over time.

### The Unified Solution
MRM InfoTech delivered a multi-tenant architecture where each institution operates its own branding, news feed, and notices while sharing a single, hardened codebase.`,
        seoTitle: 'Multi-Institution Website Governance Platform Case Study',
        seoDescription:
          'Centralized website deployment platform for multi-branch organizations and educational networks.',
      },
    },
    {
      slug: 'apex-fleet-logistics-engine',
      sortOrder: 4,
      projectWorkStatus: 'COMPLETED',
      isFeatured: false,
      isVerified: true,
      evidenceNote:
        'Real-time GPS telemetry and fuel dispatch engine verified in corporate fleet tests.',
      publishedAt: new Date('2026-03-20T00:00:00.000Z'),
      clientApprovedAt: new Date('2026-03-20T00:00:00.000Z'),
      productId: null,
      serviceId: customDevService?.id || null,
      liveUrl: null,
      frontendRepoUrl: 'https://github.com/mrminfotech/apex-fleet-ui',
      backendRepoUrl: 'https://github.com/mrminfotech/apex-fleet-core',
      showFrontendRepo: true,
      showBackendRepo: false,
      frontendTechSummary: ['Next.js App Router', 'Mapbox GL', 'Tailwind CSS', 'WebSockets'],
      backendTechSummary: ['NestJS', 'PostgreSQL PostGIS', 'Socket.io', 'Redis Streams'],
      dbToolsSummary: ['PostgreSQL PostGIS', 'TimescaleDB', 'Docker'],
      metrics: [
        { label: 'Fuel Consumption Saved', value: '18%' },
        { label: 'Fleet Vehicles Tracked', value: '350+' },
        { label: 'Route Dispatch Latency', value: '120ms' },
        { label: 'On-Time Deliveries', value: '98.5%' },
      ],
      translation: {
        title: 'Apex Fleet Telemetry — Real-time Dispatch & Route Optimization',
        summary:
          'IoT-powered fleet management dashboard providing live GPS telemetry, fuel consumption analytics, and automated delivery dispatch for freight carriers.',
        challenge:
          'Logistics dispatchers lacked real-time visibility into vehicle locations, fuel theft was rampant, and manual driver communication delayed time-critical industrial shipments.',
        solution:
          'Developed a high-throughput geospatial platform consuming MQTT and HTTP telemetry from on-board vehicle sensors, featuring live route mapping and predictive arrival estimations.',
        result:
          'Fleet fuel expenses dropped by 18% within 90 days, delivery reliability increased to 98.5%, and dispatch latency was reduced to sub-second speeds.',
        body: `### High-Throughput IoT Architecture
Consuming 1,000+ telemetry pings per second required a spatial database design with PostGIS and Redis memory caching.`,
        seoTitle: 'Apex Fleet Telemetry & Logistics Platform Case Study | MRM InfoTech',
        seoDescription:
          'Enterprise fleet tracking and automated dispatch engine saving 18% fuel across 350+ vehicles.',
      },
    },
  ];

  for (const item of projectsToSeed) {
    const { translation, ...studyData } = item;
    const existing = await prisma.caseStudy.findUnique({ where: { slug: item.slug } });

    let caseStudyId = existing?.id;
    if (existing) {
      await prisma.caseStudy.update({
        where: { id: existing.id },
        data: studyData,
      });
    } else {
      const created = await prisma.caseStudy.create({
        data: studyData,
      });
      caseStudyId = created.id;
    }

    if (caseStudyId) {
      await prisma.caseStudyTranslation.upsert({
        where: {
          caseStudyId_locale: {
            caseStudyId,
            locale: 'en',
          },
        },
        update: {
          ...translation,
          status: 'PUBLISHED',
        },
        create: {
          caseStudyId,
          locale: 'en',
          ...translation,
          status: 'PUBLISHED',
        },
      });
    }
  }

  console.log('Seeding Blog Posts...');

  const softwareCat = await prisma.postCategory.findUnique({
    where: { slug: 'software-engineering' },
  });
  const cloudCat = await prisma.postCategory.findUnique({ where: { slug: 'saas-cloud' } });
  const digitalCat = await prisma.postCategory.findUnique({
    where: { slug: 'digital-transformation' },
  });

  const nextTag = await prisma.tag.findUnique({ where: { slug: 'next-js' } });
  const nestTag = await prisma.tag.findUnique({ where: { slug: 'nestjs' } });
  const saasTag = await prisma.tag.findUnique({ where: { slug: 'saas' } });
  const enterpriseTag = await prisma.tag.findUnique({ where: { slug: 'enterprise' } });

  const blogPostsToSeed = [
    {
      key: 'architecting-multi-tenant-saas',
      categoryId: cloudCat?.id || null,
      readingMinutes: 7,
      isFeatured: true,
      tagIds: [nestTag?.id, saasTag?.id, enterpriseTag?.id].filter(Boolean) as string[],
      translation: {
        slug: 'architecting-multi-tenant-cloud-saas',
        title: 'Architecting Multi-Tenant Cloud SaaS with PostgreSQL Row-Level Security & NestJS',
        excerpt:
          'A comprehensive engineering deep dive into building secure, tenant-isolated cloud software without running separate database clusters for every organization.',
        body: `## The Multi-Tenancy Conundrum
When building enterprise B2B SaaS platforms, data isolation is non-negotiable. Traditional approaches either share all tables with a simple \`tenant_id\` filter (which is prone to developer oversight and catastrophic data leaks) or spin up dedicated database instances per client (which multiplies infrastructure and maintenance costs exponentially).

In this engineering breakdown, we explore how **PostgreSQL Row-Level Security (RLS)** combined with **NestJS Request Scoping** gives you the best of both worlds: hardware efficiency and mathematical isolation.

---

### Understanding Row-Level Security (RLS)
PostgreSQL provides native kernel-level Row-Level Security. Once enabled on a table, PostgreSQL will reject any query that does not satisfy the active security policy, even if the application code accidentally omits \`WHERE tenant_id = ...\`.

\`\`\`sql
-- Enable RLS on the table
ALTER TABLE "AccountLedger" ENABLE ROW LEVEL SECURITY;

-- Create an isolation policy
CREATE POLICY tenant_isolation_policy ON "AccountLedger"
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
\`\`\`

---

### Connecting NestJS with Scoped Database Context
In NestJS, we intercept each incoming HTTP request, extract the verified tenant identity from the JWT session, and set the transactional session parameter before executing queries:

\`\`\`typescript
@Injectable()
export class TenantTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async executeInTenantContext<T>(tenantId: string, operation: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        \`SET LOCAL app.current_tenant_id = '\${tenantId}'\`
      );
      return operation(tx as unknown as PrismaClient);
    });
  }
}
\`\`\`

---

### Benchmarking Performance Under Load
In our high-concurrency benchmarks across 10,000 simulated institutional requests:
- **P95 Latency:** Remained under **42ms**.
- **Memory Footprint:** 65% lower than separate schema architectures.
- **Data Leakage Risk:** **Zero**, verified by penetration testing suites.

By embedding isolation at the database engine layer, MRM InfoTech ensures that our institutional platforms like **EduManage BD** and **MediSheba BD** provide bulletproof security for thousands of organizations without operational overhead.`,
        seoTitle: 'Multi-Tenant SaaS Architecture with PostgreSQL RLS & NestJS | MRM InfoTech',
        seoDescription:
          'Learn how MRM InfoTech architects multi-tenant cloud software with PostgreSQL Row-Level Security and NestJS.',
      },
    },
    {
      key: 'sub-second-nextjs-performance',
      categoryId: softwareCat?.id || null,
      readingMinutes: 5,
      isFeatured: true,
      tagIds: [nextTag?.id, enterpriseTag?.id].filter(Boolean) as string[],
      translation: {
        slug: 'sub-second-nextjs-performance-tuning',
        title: 'Sub-Second First Contentful Paint: Tuning Next.js 16 with Partial Pre-Rendering',
        excerpt:
          'Practical strategies and architectural patterns we used to achieve sub-second page loads across Next.js 16 App Router on mobile devices.',
        body: `## Web Performance is Business Critical
Every 100 milliseconds of latency directly correlates to visitor drop-offs and lower conversion rates. In emerging markets where 4G mobile networks fluctuate in bandwidth, heavy client-side JavaScript bundles can severely hinder the user experience.

Here is how MRM InfoTech tunes Next.js 16 App Router applications to achieve **sub-second First Contentful Paint (FCP)** and a perfect 100 Lighthouse performance score.

---

### 1. Embracing Server Components as the Default
The biggest mistake in modern React development is sprinkling \`'use client'\` at the top of every page. Client components force the browser to download, parse, and execute hundreds of kilobytes of JavaScript before rendering a single pixel.

By keeping pages, layouts, and data fetchers strictly as **React Server Components (RSC)**:
- **Zero Bundle Size:** Server libraries (like Prisma or markdown parsers) never touch the client bundle.
- **Instant HTML Streaming:** The browser starts painting HTML from the very first byte received.

---

### 2. Next-Gen Partial Pre-Rendering (PPR)
With Next.js 16, Partial Pre-Rendering merges the speed of static site generation with dynamic data freshness:

\`\`\`tsx
export default function ProductPage() {
  return (
    <main>
      {/* Static Shell Paints in < 150ms */}
      <ProductHeroStatic />

      {/* Dynamic Data Streams Asynchronously */}
      <Suspense fallback={<ProductKpiSkeleton />}>
        <LiveMetricsFeed />
      </Suspense>
    </main>
  );
}
\`\`\`

---

### 3. Contrast-Validated Semantic CSS Variables
Instead of bloating the DOM with thousands of utility classes, we utilize a unified 5-theme token architecture using native CSS custom properties. This reduces CSS payload to less than **25 KB** compressed while providing dynamic runtime theme toggling with zero flash of unstyled content (FOUC).`,
        seoTitle: 'Next.js 16 Sub-Second Performance Tuning Guide | MRM InfoTech',
        seoDescription:
          'How MRM InfoTech achieves sub-second First Contentful Paint and high Lighthouse scores with Next.js 16.',
      },
    },
    {
      key: 'zero-trust-rbac-cloud-saas',
      categoryId: cloudCat?.id || null,
      readingMinutes: 6,
      isFeatured: false,
      tagIds: [enterpriseTag?.id, nestTag?.id].filter(Boolean) as string[],
      translation: {
        slug: 'zero-trust-rbac-in-modern-cloud-saas',
        title: 'Zero-Trust Role-Based Access Control (RBAC) in Mission-Critical Systems',
        excerpt:
          'How we design granular, permission-based authorization models with cryptographic session auditing and tamper-proof logging.',
        body: `## The Flaw of Simple Role Checks
Most web applications rely on simple role checks like \`if (user.role === 'admin')\`. While this works for simple prototypes, enterprise systems inevitably need nuanced permissions:
- Can an accountant export billing summaries without seeing payroll?
- Can a department head review applicant resumes without deleting job postings?

Role-based access quickly becomes brittle unless decoupled into **granular permission keys**.

---

### Permission-Driven Architecture
In MRM InfoTech's core backend architecture, roles are merely convenient collections of discrete atomic permissions:

\`\`\`typescript
export const PRODUCT_PERMISSIONS = {
  read: 'product:read',
  write: 'product:write',
  publish: 'product:publish',
  delete: 'product:delete',
} as const;
\`\`\`

Controllers declare exact permissions rather than roles:
\`\`\`typescript
@Patch(':id/publish')
@Permissions('product:publish')
async publishProduct(@Param('id') id: string) {
  return this.productsService.publish(id);
}
\`\`\`

This decouples code logic from organizational titles, allowing enterprise clients to customize role permission matrices directly from their admin dashboard without code deploys.`,
        seoTitle: 'Zero-Trust RBAC in Modern Cloud SaaS | MRM InfoTech Insights',
        seoDescription:
          'Architecting granular role-based access control and security guards for mission-critical software.',
      },
    },
    {
      key: 'automated-financial-reconciliation',
      categoryId: digitalCat?.id || null,
      readingMinutes: 8,
      isFeatured: false,
      tagIds: [saasTag?.id, enterpriseTag?.id].filter(Boolean) as string[],
      translation: {
        slug: 'automated-financial-reconciliation-engines',
        title: 'Automated Financial Reconciliation: Eliminating Manual Verification Queues',
        excerpt:
          'Engineering idempotent webhook processing and real-time ledger settlement for high-volume billing platforms.',
        body: `## The Hidden Cost of Manual Billing
In fast-growing organizations, manual payment verification creates friction, human error, and delayed service delivery. Customers submit transaction IDs, while accountants manually compare bank SMS statements against database records.

---

### The Idempotent Webhook Pattern
To achieve 100% automated settlement, MRM InfoTech implements cryptographic webhook validation with distributed locking:

\`\`\`typescript
async processPaymentWebhook(payload: WebhookPayload, signature: string): Promise<SettlementResult> {
  // 1. Verify cryptographic hash
  this.verifyHmacSignature(payload, signature);

  // 2. Acquire Redis distributed lock by transaction ID to prevent double-spending
  const lock = await this.redis.set(\`lock:tx:\${payload.transactionId}\`, '1', 'EX', 30, 'NX');
  if (!lock) {
    throw new ConflictException('Transaction is currently being settled');
  }

  // 3. Atomically credit invoice and emit ledger event
  return this.settleInvoiceTransaction(payload);
}
\`\`\`

This guarantees that even if a payment gateway dispatches duplicate webhooks simultaneously, each transaction is processed exactly once with zero double-crediting.`,
        seoTitle: 'Automated Financial Reconciliation Engines | MRM InfoTech Engineering',
        seoDescription:
          'Designing idempotent webhook architectures and automated ledger reconciliation for high-volume transactions.',
      },
    },
  ];

  for (const postItem of blogPostsToSeed) {
    const { translation, tagIds, ...postData } = postItem;

    const existingPost = await prisma.post.findUnique({ where: { key: postItem.key } });
    let postId = existingPost?.id;

    if (!existingPost) {
      const created = await prisma.post.create({
        data: {
          key: postData.key,
          categoryId: postData.categoryId,
          readingMinutes: postData.readingMinutes,
          isFeatured: postData.isFeatured,
          tags: {
            create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
          },
        },
      });
      postId = created.id;
    } else {
      await prisma.post.update({
        where: { id: existingPost.id },
        data: {
          categoryId: postData.categoryId,
          readingMinutes: postData.readingMinutes,
          isFeatured: postData.isFeatured,
        },
      });
    }

    if (postId) {
      await prisma.postTranslation.upsert({
        where: {
          postId_locale: {
            postId,
            locale: 'en',
          },
        },
        update: {
          ...translation,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
        create: {
          postId,
          locale: 'en',
          ...translation,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
    }
  }

  console.log('Seeding completed successfully!');
}

seedProjectsAndBlog()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
