import { PrismaClient, ContentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Service Categories and Initial 6 Services...');

  // 1. Seed Service Categories
  const categoriesData = [
    {
      name: 'Web Development',
      slug: 'web-development',
      description: 'Professional website design and development solutions for modern businesses.',
      icon: 'Code2',
      displayOrder: 1,
    },
    {
      name: 'Custom Software Development',
      slug: 'custom-software',
      description: 'Tailored software architectures designed around specific business workflows.',
      icon: 'Cpu',
      displayOrder: 2,
    },
    {
      name: 'Mobile App Development',
      slug: 'mobile-apps',
      description: 'Mobile applications for businesses and organizations across iOS and Android.',
      icon: 'Smartphone',
      displayOrder: 3,
    },
    {
      name: 'UI/UX & Product Design',
      slug: 'ui-ux-design',
      description: 'User-focused interface and experience design for web, SaaS, and mobile products.',
      icon: 'Layout',
      displayOrder: 4,
    },
    {
      name: 'SEO Optimization',
      slug: 'seo-optimization',
      description: 'Technical and content-driven search engine optimization for organic growth.',
      icon: 'Search',
      displayOrder: 5,
    },
    {
      name: 'Digital Marketing & Advertising',
      slug: 'digital-marketing',
      description: 'Targeted campaigns and digital growth strategies to connect with ideal customers.',
      icon: 'BarChart3',
      displayOrder: 6,
    },
    {
      name: 'Cloud & Infrastructure',
      slug: 'cloud-infrastructure',
      description: 'Scalable cloud infrastructure, microservices, and database engineering.',
      icon: 'Cloud',
      displayOrder: 7,
    },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoriesData) {
    const createdCat = await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        displayOrder: cat.displayOrder,
        isActive: true,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        displayOrder: cat.displayOrder,
        isActive: true,
      },
    });
    categoryMap.set(cat.slug, createdCat.id);
  }
  console.log(`✅ Seeded ${categoryMap.size} Service Categories`);

  // Default 6-step working process
  const defaultProcess = [
    {
      stepNumber: 1,
      title: 'Discovery & Consultation',
      description: 'Understand the client’s business model, objectives, technical challenges, and project requirements.',
      icon: 'Compass',
    },
    {
      stepNumber: 2,
      title: 'Planning & Strategy',
      description: 'Define the solution architecture, milestone roadmap, technical stack, and security protocols.',
      icon: 'Layers',
    },
    {
      stepNumber: 3,
      title: 'Design & Development',
      description: 'Execute agile engineering sprints with high usability standards, clean code, and regular demos.',
      icon: 'Code2',
    },
    {
      stepNumber: 4,
      title: 'Testing & Quality Assurance',
      description: 'Conduct automated test suites, cross-device responsiveness checks, and penetration audits.',
      icon: 'ShieldCheck',
    },
    {
      stepNumber: 5,
      title: 'Launch & Deployment',
      description: 'Deploy to high-availability cloud infrastructure with zero downtime and automated SSL certificates.',
      icon: 'Rocket',
    },
    {
      stepNumber: 6,
      title: 'Support & Improvement',
      description: 'Provide continuous monitoring, proactive security updates, performance tuning, and scaling.',
      icon: 'Workflow',
    },
  ];

  // 2. Initial 6 Services Specification
  const servicesData = [
    {
      slug: 'web-development',
      title: 'Web Development',
      name: 'Web Development',
      tagline: 'High-performance, scalable websites and web applications built for modern businesses.',
      shortDescription: 'Professional website design and development solutions tailored to your brand, audience, and growth goals.',
      fullDescription: 'From high-converting corporate portals to complex multi-tenant web applications, MRM InfoTech engineers custom web solutions that combine speed, visual excellence, and rock-solid architectural reliability. We build with modern frameworks like Next.js, React, and TypeScript to ensure lightning-fast page speeds, SEO visibility, and smooth user interactions.',
      problemSolved: 'Slow-loading legacy websites, disjointed user journeys, poor mobile responsiveness, high bounce rates, and inflexible CMS platforms that cannot scale.',
      targetAudience: 'Startups, growing enterprises, corporate institutions, and digital businesses needing a modern, performant web presence.',
      ourApproachSummary: 'We treat web development as a craft, emphasizing clean component hierarchies, server-side rendering for optimal Core Web Vitals, and responsive layouts that look stunning on any device.',
      categorySlug: 'web-development',
      icon: 'Code2',
      isFeatured: true,
      showOnHomepage: true,
      showOnServicesPage: true,
      showInNavbar: true,
      servicesPageOrder: 1,
      homepageOrder: 1,
      navbarOrder: 1,
      featuredOrder: 1,
      sortOrder: 1,
      offerings: [
        { title: 'Business Website Development', shortDesc: 'Professional corporate websites engineered for credibility, speed, and lead generation.' },
        { title: 'Corporate Website Development', shortDesc: 'Multi-page enterprise portals with role-based team management and internationalization.' },
        { title: 'Landing Page Development', shortDesc: 'High-converting, performance-optimized marketing landing pages with instant load speeds.' },
        { title: 'E-commerce Website Development', shortDesc: 'Custom online stores with payment gateways, inventory sync, and fluid checkouts.' },
        { title: 'SaaS Website Development', shortDesc: 'Modern product marketing websites with interactive feature walkthroughs and onboarding.' },
        { title: 'Portfolio Website Development', shortDesc: 'Creative showcases for agencies, architects, and institutions requiring visual impact.' },
        { title: 'Educational Website Development', shortDesc: 'Portals for schools, colleges, and academies with course catalogs and student portals.' },
        { title: 'Custom Web Applications', shortDesc: 'Interactive web apps tailored to specialized organizational workflows and data views.' },
        { title: 'Website Redesign & Modernization', shortDesc: 'Upgrading legacy sites into responsive Next.js architectures with zero loss of SEO equity.' },
        { title: 'Website Maintenance & SLA Support', shortDesc: 'Continuous security patching, performance audits, uptime monitoring, and content updates.' },
      ],
      benefits: [
        { title: 'Sub-Second Page Loads', desc: 'Server-side rendering and edge caching ensure instant page delivery.' },
        { title: 'Mobile-First Responsiveness', desc: 'Fluid layouts tested across 30+ screen resolutions and device form factors.' },
        { title: 'Built-In SEO Optimization', desc: 'Valid semantic HTML, OpenGraph tags, and automatic JSON-LD structured data.' },
        { title: 'Scalable Modular Monoliths', desc: 'Clean separation of concerns ready for multi-million visitor traffic spikes.' },
      ],
      faqs: [
        { question: 'What technologies do you use for web development?', answer: 'We primarily build with Next.js 16, React 19, TypeScript, Tailwind CSS, and NestJS backends with PostgreSQL databases.' },
        { question: 'Will my website be mobile-friendly and search engine optimized?', answer: 'Yes, 100%. Every website we deliver is responsive across mobile, tablet, and desktop, and complies with Google’s Core Web Vitals.' },
        { question: 'Can I manage content without coding knowledge?', answer: 'Yes. We provide a custom modular CMS Admin Dashboard tailored to your exact business needs.' },
      ],
    },
    {
      slug: 'custom-software-development',
      title: 'Custom Software Development',
      name: 'Custom Software Development',
      tagline: 'Tailored software architectures designed around your exact operational workflows.',
      shortDescription: 'Tailored software solutions designed around specific business requirements and long-term scalability.',
      fullDescription: 'Off-the-shelf software often forces businesses into rigid workflows that stifle growth. MRM InfoTech designs and develops bespoke software architectures built specifically to match your operational logic, eliminate manual overhead, and integrate seamlessly with your existing technology ecosystem.',
      problemSolved: 'Fragmented spreadsheets, manual data entry errors, disconnected legacy tools, and vendor lock-in from inflexible commercial software.',
      targetAudience: 'Enterprises, logistics operators, manufacturing units, healthcare providers, and high-growth companies with unique operational processes.',
      ourApproachSummary: 'We architect systems using clean Domain-Driven Design (DDD), modular monoliths or microservices, strict database integrity, and comprehensive automated test suites.',
      categorySlug: 'custom-software',
      icon: 'Cpu',
      isFeatured: true,
      showOnHomepage: true,
      showOnServicesPage: true,
      showInNavbar: true,
      servicesPageOrder: 2,
      homepageOrder: 2,
      navbarOrder: 2,
      featuredOrder: 2,
      sortOrder: 2,
      offerings: [
        { title: 'Custom Business Software', shortDesc: 'Bespoke systems addressing proprietary business logic and internal operations.' },
        { title: 'SaaS Application Development', shortDesc: 'Multi-tenant cloud platforms with subscription billing, telemetry, and isolation.' },
        { title: 'Enterprise Software Systems', shortDesc: 'Mission-critical software managing department hierarchies and enterprise compliance.' },
        { title: 'ERP Development', shortDesc: 'Unified enterprise resource planning covering inventory, HR, accounting, and supply chain.' },
        { title: 'CRM Development', shortDesc: 'Client relationship management systems with automated pipelines and communication logs.' },
        { title: 'Business Management Systems', shortDesc: 'Centralized operations hubs providing real-time executive reporting and oversight.' },
        { title: 'Workflow Automation Engines', shortDesc: 'Eliminating repetitive human tasks through automated background workers and rules.' },
        { title: 'API Development & Integration', shortDesc: 'Robust REST and GraphQL APIs with OpenAPI/Swagger documentation and rate limiting.' },
        { title: 'Database-Driven Applications', shortDesc: 'High-concurrency PostgreSQL and Redis architectures with strict ACID guarantees.' },
        { title: 'Existing Software Modernization', shortDesc: 'Refactoring legacy codebases into secure, cloud-native modular microservices.' },
      ],
      benefits: [
        { title: '100% Workflow Alignment', desc: 'Engineered specifically for your company’s unique procedures and rules.' },
        { title: 'Total Data Ownership', desc: 'No vendor lock-in; your company retains full rights to the code and data.' },
        { title: 'Enterprise Bank-Grade Security', desc: 'OWASP Top 10 compliance, Argon2 password hashing, and encrypted backups.' },
        { title: 'High-Throughput Concurrency', desc: 'PostgreSQL connection pooling and Redis caching for seamless multi-user operations.' },
      ],
      faqs: [
        { question: 'How long does a custom software project typically take?', answer: 'Project timelines range from 6 to 12 weeks for MVPs and 3 to 6 months for complex enterprise platforms, executed in two-week agile sprints.' },
        { question: 'Do we own the source code after delivery?', answer: 'Yes. You receive full ownership of the source code, database architecture, and deployment configurations.' },
      ],
    },
    {
      slug: 'mobile-app-development',
      title: 'Mobile App Development',
      name: 'Mobile App Development',
      tagline: 'Intuitive Android, iOS, and cross-platform mobile experiences.',
      shortDescription: 'Mobile applications for businesses and organizations looking to engage users on the go.',
      fullDescription: 'Mobile is the primary touchpoint for modern consumers and field workers. MRM InfoTech builds responsive, high-performance mobile applications that deliver native performance, offline resilience, and fluid 60fps animations across both iOS and Android platforms.',
      problemSolved: 'Inconsistent user experiences across devices, app store rejection risks, battery drainage, and clunky mobile web wrappers.',
      targetAudience: 'Retailers, service providers, educational platforms, field management teams, and consumer startups.',
      ourApproachSummary: 'We build with React Native and modern native bridges, ensuring code reusability while maintaining direct hardware access for cameras, GPS, biometric sensors, and push notifications.',
      categorySlug: 'mobile-apps',
      icon: 'Smartphone',
      isFeatured: false,
      showOnHomepage: true,
      showOnServicesPage: true,
      showInNavbar: true,
      servicesPageOrder: 3,
      homepageOrder: 3,
      navbarOrder: 3,
      featuredOrder: 3,
      sortOrder: 3,
      offerings: [
        { title: 'Android Application Development', shortDesc: 'Native and cross-platform apps optimized for the diverse Android ecosystem.' },
        { title: 'iOS Application Development', shortDesc: 'Refined, App Store-compliant applications delivering fluid iOS experiences.' },
        { title: 'Cross-Platform Applications', shortDesc: 'Unified codebases using React Native to cut development costs without sacrificing speed.' },
        { title: 'Business Mobile Applications', shortDesc: 'Internal operational tools for field engineers, delivery agents, and managers.' },
        { title: 'Customer-Facing Mobile Apps', shortDesc: 'Engaging consumer apps with instant payments, loyalty rewards, and push notifications.' },
        { title: 'API-Integrated Mobile Apps', shortDesc: 'Seamless integration with existing enterprise ERPs, cloud databases, and CRMs.' },
        { title: 'Mobile App UI/UX Design', shortDesc: 'Ergonomic mobile interfaces designed for one-handed operation and thumb ergonomics.' },
        { title: 'Application Maintenance & Upgrades', shortDesc: 'Ongoing OS compatibility updates, crash monitoring, and feature iteration.' },
      ],
      benefits: [
        { title: 'Cross-Platform Cost Efficiency', desc: 'Single codebase powering both iOS and Android reduces time-to-market by 40%.' },
        { title: 'Offline-First Capabilities', desc: 'Local SQLite/MMKV caching keeps apps responsive even without cellular network.' },
        { title: 'Biometric Security', desc: 'FaceID and fingerprint authentication protecting sensitive user records.' },
      ],
      faqs: [
        { question: 'Will the app work on both iPhone and Android?', answer: 'Yes. Our cross-platform solutions run seamlessly on both iOS and Android devices.' },
        { question: 'Do you handle the App Store and Google Play submission process?', answer: 'Yes. We manage the entire store compliance, certificate generation, and submission lifecycle.' },
      ],
    },
    {
      slug: 'ui-ux-design',
      title: 'UI/UX Design',
      name: 'UI/UX Design',
      tagline: 'User-centered interface systems that combine clarity with modern aesthetics.',
      shortDescription: 'User-focused interface and experience design for web, SaaS dashboards, and mobile products.',
      fullDescription: 'Great software starts with deep human empathy. MRM InfoTech crafts user-centered digital interfaces that eliminate friction, clarify complex data structures, and turn everyday users into enthusiastic product advocates. We deliver complete Figma design systems and clickable prototypes ready for engineering handoff.',
      problemSolved: 'Confusing user journeys, cluttered dashboards, high customer drop-off during onboarding, and inconsistent brand styling across platforms.',
      targetAudience: 'SaaS founders, product teams, enterprise software directors, and consumer digital brands.',
      ourApproachSummary: 'We combine user research, wireframing, high-fidelity UI design, and interactive prototyping with comprehensive design token systems.',
      categorySlug: 'ui-ux-design',
      icon: 'Layout',
      isFeatured: false,
      showOnHomepage: true,
      showOnServicesPage: true,
      showInNavbar: true,
      servicesPageOrder: 4,
      homepageOrder: 4,
      navbarOrder: 4,
      featuredOrder: 4,
      sortOrder: 4,
      offerings: [
        { title: 'Website UI/UX Design', shortDesc: 'Art-directed web layouts with strong visual hierarchy and conversion storytelling.' },
        { title: 'SaaS Dashboard Design', shortDesc: 'Ergonomic data analytics consoles and workflow portals with clean typography.' },
        { title: 'Mobile App UI/UX Design', shortDesc: 'Tactile mobile interaction design focused on tap targets and micro-animations.' },
        { title: 'Admin Dashboard Design', shortDesc: 'Dense, productivity-focused management screens engineered for fast daily operations.' },
        { title: 'Wireframing & Information Architecture', shortDesc: 'Low-fidelity structural blueprints defining content flow and navigation pathways.' },
        { title: 'Interactive Prototyping', shortDesc: 'Clickable Figma prototypes simulating the finished software experience before coding.' },
        { title: 'Design Systems & Component Libraries', shortDesc: 'Standardized typography, spacing, and UI components ensuring brand consistency.' },
        { title: 'User Experience Audits & Improvements', shortDesc: 'Analyzing existing software to identify usability bottlenecks and conversion friction.' },
        { title: 'Interface Modernization', shortDesc: 'Transforming outdated software interfaces into clean, contemporary digital experiences.' },
      ],
      benefits: [
        { title: 'Higher User Retention', desc: 'Intuitive layouts reduce onboarding churn and customer support tickets.' },
        { title: 'Accelerated Development', desc: 'Engineers build faster with complete Figma component libraries and auto-layout.' },
        { title: 'Consistent Brand Elevation', desc: 'Unified design tokens across web, mobile, and administrative surfaces.' },
      ],
      faqs: [
        { question: 'What tools do you use for design?', answer: 'We design primarily in Figma, delivering reusable component libraries, design tokens, and clickable prototypes.' },
        { question: 'Do you provide design files ready for developers?', answer: 'Yes. We deliver organized Figma files with auto-layout, typography hierarchies, and exportable SVG assets.' },
      ],
    },
    {
      slug: 'seo-optimization',
      title: 'SEO Optimization',
      name: 'SEO Optimization',
      tagline: 'Technical and content-driven search optimization for sustainable organic growth.',
      shortDescription: 'Search engine optimization to improve website visibility, speed, and organic discovery.',
      fullDescription: 'Building a great website is only half the battle; potential customers must be able to find it. MRM InfoTech provides technical and algorithmic SEO engineering that elevates your website’s ranking on Google, optimizes Core Web Vitals, and captures high-intent organic search queries.',
      problemSolved: 'Low organic traffic, poor Google search rankings, crawling errors, missing structured data, and slow page speed scores.',
      targetAudience: 'Local businesses, e-commerce stores, professional service firms, and B2B technology companies.',
      ourApproachSummary: 'We address search optimization from an engineering perspective: fixing server response times, structuring JSON-LD schema, optimizing heading tags, and executing targeted keyword clustering.',
      categorySlug: 'seo-optimization',
      icon: 'Search',
      isFeatured: false,
      showOnHomepage: true,
      showOnServicesPage: true,
      showInNavbar: true,
      servicesPageOrder: 5,
      homepageOrder: 5,
      navbarOrder: 5,
      featuredOrder: 5,
      sortOrder: 5,
      offerings: [
        { title: 'Technical SEO Audits', shortDesc: 'Comprehensive analysis of crawlability, indexing, robots.txt, and XML sitemaps.' },
        { title: 'On-Page SEO Optimization', shortDesc: 'Optimizing titles, meta descriptions, heading structures, and semantic content.' },
        { title: 'Website Speed & Core Web Vitals', shortDesc: 'Enhancing Largest Contentful Paint (LCP), FID, and Cumulative Layout Shift (CLS).' },
        { title: 'Keyword Research & Clustering', shortDesc: 'Identifying high-volume, low-competition commercial search terms for your industry.' },
        { title: 'Content Optimization & Structuring', shortDesc: 'Aligning web copy with user search intent and semantic search algorithms.' },
        { title: 'Website Architecture Optimization', shortDesc: 'Refining internal linking and URL taxonomy for optimal Google crawl budget.' },
        { title: 'Local SEO & Google Business Profile', shortDesc: 'Local search visibility for regional businesses targeting nearby clients.' },
        { title: 'Schema Markup & Rich Snippets', shortDesc: 'Implementing JSON-LD structured data for FAQ, organization, and product snippets.' },
      ],
      benefits: [
        { title: 'Sustainable Organic Pipeline', desc: 'Generate consistent inbound inquiries without continuous ad spend.' },
        { title: 'Superior Page Speed Scores', desc: 'Achieve 90+ Google PageSpeed scores through modern Next.js rendering.' },
        { title: 'Rich Google Search Results', desc: 'Structured schema triggers rich snippets, FAQs, and breadcrumbs in SERPs.' },
      ],
      faqs: [
        { question: 'How long does it take to see SEO results?', answer: 'Technical SEO fixes take effect within 2 to 4 weeks, while organic keyword ranking gains typically compound over 3 to 6 months.' },
        { question: 'Do you perform ethical white-hat SEO only?', answer: 'Yes, 100%. We strictly adhere to Google Search Essentials and white-hat engineering best practices.' },
      ],
    },
    {
      slug: 'digital-marketing',
      title: 'Digital Marketing & Advertising',
      name: 'Digital Marketing & Advertising',
      tagline: 'Targeted campaigns and digital strategies to connect with your ideal audience.',
      shortDescription: 'Digital marketing solutions to help businesses reach, engage, and convert their target audiences.',
      fullDescription: 'Modern growth requires a data-driven marketing engine. MRM InfoTech develops multi-channel digital advertising campaigns, conversion funnels, and brand communication strategies that turn casual scrollers into paying clients and loyal brand advocates.',
      problemSolved: 'Wasted advertising budgets on unqualified clicks, poor ad creative performance, lack of attribution tracking, and stagnant social channels.',
      targetAudience: 'Product brands, educational institutions, service agencies, and organizations looking to scale customer acquisition.',
      ourApproachSummary: 'We combine compelling visual creative with algorithmic ad bidding on Meta, Google, and LinkedIn, supported by continuous A/B split testing and ROAS optimization.',
      categorySlug: 'digital-marketing',
      icon: 'BarChart3',
      isFeatured: false,
      showOnHomepage: true,
      showOnServicesPage: true,
      showInNavbar: true,
      servicesPageOrder: 6,
      homepageOrder: 6,
      navbarOrder: 6,
      featuredOrder: 6,
      sortOrder: 6,
      offerings: [
        { title: 'Digital Marketing Strategy', shortDesc: 'Comprehensive go-to-market roadmaps tailored to your audience and competitive landscape.' },
        { title: 'Social Media Marketing', shortDesc: 'Brand storytelling and community engagement across Facebook, Instagram, and LinkedIn.' },
        { title: 'Facebook & Instagram Advertising', shortDesc: 'Targeted paid ad campaigns with pixel tracking and lookalike audience modeling.' },
        { title: 'Google Ads Management', shortDesc: 'High-intent search, display, and YouTube video campaigns targeting ready-to-buy users.' },
        { title: 'Paid Advertising Campaigns', shortDesc: 'Omnichannel ad deployment with strict cost-per-acquisition (CPA) discipline.' },
        { title: 'Social Media Content Strategy', shortDesc: 'Visual asset creation, editorial calendars, and brand positioning copy.' },
        { title: 'Campaign Optimization & A/B Testing', shortDesc: 'Split testing ad hooks, copy variations, and landing page conversion rates.' },
        { title: 'Marketing Performance Analysis', shortDesc: 'Clear executive reporting on ROI, ROAS, click-through rates, and customer lifetime value.' },
      ],
      benefits: [
        { title: 'Measurable Return on Ad Spend (ROAS)', desc: 'Transparent conversion tracking so you see exactly what each dollar generates.' },
        { title: 'Precise Demographic Targeting', desc: 'Zero wasted impressions by focusing on verified decision-makers and buyers.' },
        { title: 'End-to-End Funnel Alignment', desc: 'Syncing advertising creatives directly with high-converting web landing pages.' },
      ],
      faqs: [
        { question: 'Which advertising platforms do you manage?', answer: 'We manage Google Ads (Search, Display, YouTube), Meta Ads (Facebook & Instagram), and LinkedIn Marketing Solutions.' },
        { question: 'How do you measure campaign success?', answer: 'We measure success through concrete metrics: Cost Per Lead (CPL), Customer Acquisition Cost (CAC), and Return on Ad Spend (ROAS).' },
      ],
    },
  ];

  for (const s of servicesData) {
    const categoryId = categoryMap.get(s.categorySlug);

    // Upsert the main Service
    const service = await prisma.service.upsert({
      where: { slug: s.slug },
      update: {
        title: s.title,
        name: s.name,
        tagline: s.tagline,
        shortDescription: s.shortDescription,
        description: s.fullDescription,
        fullDescription: s.fullDescription,
        problemSolved: s.problemSolved,
        problemsAddressed: s.problemSolved,
        targetAudience: s.targetAudience,
        ourApproachSummary: s.ourApproachSummary,
        approach: s.ourApproachSummary,
        status: ContentStatus.PUBLISHED,
        isFeatured: s.isFeatured,
        showOnServicesPage: s.showOnServicesPage,
        showOnHomepage: s.showOnHomepage,
        showInNavbar: s.showInNavbar,
        showInNavDropdown: s.showInNavbar,
        allowPublicDetail: true,
        servicesPageOrder: s.servicesPageOrder,
        homepageOrder: s.homepageOrder,
        navbarOrder: s.navbarOrder,
        featuredOrder: s.featuredOrder,
        sortOrder: s.sortOrder,
        icon: s.icon,
        categoryId,
        seoTitle: `${s.title} | MRM InfoTech`,
        seoDescription: s.shortDescription,
        metaDescription: s.shortDescription,
      },
      create: {
        slug: s.slug,
        title: s.title,
        name: s.name,
        tagline: s.tagline,
        shortDescription: s.shortDescription,
        description: s.fullDescription,
        fullDescription: s.fullDescription,
        problemSolved: s.problemSolved,
        problemsAddressed: s.problemSolved,
        targetAudience: s.targetAudience,
        ourApproachSummary: s.ourApproachSummary,
        approach: s.ourApproachSummary,
        status: ContentStatus.PUBLISHED,
        isFeatured: s.isFeatured,
        showOnServicesPage: s.showOnServicesPage,
        showOnHomepage: s.showOnHomepage,
        showInNavbar: s.showInNavbar,
        showInNavDropdown: s.showInNavbar,
        allowPublicDetail: true,
        servicesPageOrder: s.servicesPageOrder,
        homepageOrder: s.homepageOrder,
        navbarOrder: s.navbarOrder,
        featuredOrder: s.featuredOrder,
        sortOrder: s.sortOrder,
        icon: s.icon,
        categoryId,
        seoTitle: `${s.title} | MRM InfoTech`,
        seoDescription: s.shortDescription,
        metaDescription: s.shortDescription,
      },
    });

    // Populate sub-collections: offerings
    await prisma.serviceOfferingItem.deleteMany({ where: { serviceId: service.id } });
    if (s.offerings?.length) {
      await prisma.serviceOfferingItem.createMany({
        data: s.offerings.map((off, idx) => ({
          serviceId: service.id,
          title: off.title,
          shortDescription: off.shortDesc,
          displayOrder: idx + 1,
          isVisible: true,
        })),
      });
    }

    // Populate sub-collections: benefits
    await prisma.serviceBenefitItem.deleteMany({ where: { serviceId: service.id } });
    if (s.benefits?.length) {
      await prisma.serviceBenefitItem.createMany({
        data: s.benefits.map((b, idx) => ({
          serviceId: service.id,
          title: b.title,
          description: b.desc,
          displayOrder: idx + 1,
          isVisible: true,
        })),
      });
    }

    // Populate sub-collections: process steps
    await prisma.serviceProcessStepItem.deleteMany({ where: { serviceId: service.id } });
    await prisma.serviceProcessStepItem.createMany({
      data: defaultProcess.map((p) => ({
        serviceId: service.id,
        stepNumber: p.stepNumber,
        title: p.title,
        description: p.description,
        icon: p.icon,
        displayOrder: p.stepNumber,
      })),
    });

    // Populate sub-collections: FAQs
    await prisma.serviceFaqItem.deleteMany({ where: { serviceId: service.id } });
    if (s.faqs?.length) {
      await prisma.serviceFaqItem.createMany({
        data: s.faqs.map((faq, idx) => ({
          serviceId: service.id,
          question: faq.question,
          answer: faq.answer,
          displayOrder: idx + 1,
          isVisible: true,
        })),
      });
    }
  }

  // Also backfill any other existing services in database so they have title, name, etc.
  const allServices = await prisma.service.findMany();
  for (const svc of allServices) {
    if (!svc.title || !svc.name) {
      const generatedName = svc.slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      await prisma.service.update({
        where: { id: svc.id },
        data: {
          title: generatedName,
          name: generatedName,
          shortDescription: svc.shortDescription || `${generatedName} specialized engineering capability.`,
          servicesPageOrder: svc.sortOrder || 10,
          homepageOrder: svc.sortOrder || 10,
          navbarOrder: svc.sortOrder || 10,
        },
      });
    }
  }

  console.log(`🎉 Successfully seeded and synchronized ${allServices.length} services!`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding services:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

