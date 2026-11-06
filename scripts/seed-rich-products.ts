import { PrismaClient, ContentStatus, LaunchStage } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 [Safe Seed] Upgrading 3 Flagship Products with Rich Relations...');

  // 1. Categories
  const catEdu = await prisma.productCategory.upsert({
    where: { slug: 'education-erp' },
    update: {
      name: 'Education Management ERP / SaaS',
      description: 'Cloud-native institutional ERP platform engineered for schools, colleges, madrasas, and universities.',
      icon: 'GraduationCap',
      displayOrder: 1,
      isActive: true,
    },
    create: {
      slug: 'education-erp',
      name: 'Education Management ERP / SaaS',
      description: 'Cloud-native institutional ERP platform engineered for schools, colleges, madrasas, and universities.',
      icon: 'GraduationCap',
      displayOrder: 1,
      isActive: true,
    },
  });

  const catHealth = await prisma.productCategory.upsert({
    where: { slug: 'healthcare-erp' },
    update: {
      name: 'Healthcare Management ERP / SaaS',
      description: 'Comprehensive clinical, diagnostic, and pathology management software for modern healthcare institutions.',
      icon: 'HeartPulse',
      displayOrder: 2,
      isActive: true,
    },
    create: {
      slug: 'healthcare-erp',
      name: 'Healthcare Management ERP / SaaS',
      description: 'Comprehensive clinical, diagnostic, and pathology management software for modern healthcare institutions.',
      icon: 'HeartPulse',
      displayOrder: 2,
      isActive: true,
    },
  });

  const catInst = await prisma.productCategory.upsert({
    where: { slug: 'institutional-platform' },
    update: {
      name: 'Institutional Website Platform',
      description: 'Centralized multi-tenant portal for chain schools, institutional clusters, and enterprise conglomerates.',
      icon: 'Building2',
      displayOrder: 3,
      isActive: true,
    },
    create: {
      slug: 'institutional-platform',
      name: 'Institutional Website Platform',
      description: 'Centralized multi-tenant portal for chain schools, institutional clusters, and enterprise conglomerates.',
      icon: 'Building2',
      displayOrder: 3,
      isActive: true,
    },
  });

  console.log('✅ Categories seeded:', catEdu.name, catHealth.name, catInst.name);

  // 2. EduManage BD
  const edu = await prisma.product.upsert({
    where: { slug: 'edumanage-bd' },
    update: {
      title: 'EduManage BD',
      tagline: 'Simplifying Education Management Through Modern Technology',
      shortDescription: 'Cloud-native educational management ecosystem designed for Bangladeshi schools, colleges, and universities.',
      description: 'EduManage BD is MRM InfoTech’s flagship institutional management system. It digitizes student admissions, academic grading, automated attendance with SMS alerts, online fee collection with bKash/Nagad reconciliation, and comprehensive administrative reporting.',
      targetAudience: 'Schools, colleges, universities, madrasas, and multi-branch coaching institutions across Bangladesh.',
      problemsAddressed: 'Paper registers, manual attendance tracking, misplaced student records, physical fee collection queues, and disconnected parent communication.',
      mainPurpose: 'To provide a unified, automated, and secure digital campus operating system that eliminates administrative friction.',
      productType: 'Education ERP / SaaS',
      stage: LaunchStage.LIVE,
      status: ContentStatus.PUBLISHED,
      isFeatured: true,
      showOnHomepage: true,
      showOnProductsPage: true,
      showInNavDropdown: true,
      allowPublicDetail: true,
      enableGallery: true,
      enableCaseStudies: true,
      enableDemos: true,
      enableFaq: true,
      displayOrder: 1,
      homepageOrder: 1,
      navOrder: 1,
      featuredOrder: 1,
      categoryId: catEdu.id,
      brandColor: '#2563EB',
      seoTitle: 'EduManage BD | Education Management ERP & Digital School Software',
      seoDescription: 'Complete cloud-native education management software for schools and colleges in Bangladesh. Digital attendance, fee collection, and grade tabulation.',
      canonicalUrl: 'https://mrminfotech.com/products/edumanage-bd',
    },
    create: {
      slug: 'edumanage-bd',
      title: 'EduManage BD',
      tagline: 'Simplifying Education Management Through Modern Technology',
      shortDescription: 'Cloud-native educational management ecosystem designed for Bangladeshi schools, colleges, and universities.',
      description: 'EduManage BD is MRM InfoTech’s flagship institutional management system. It digitizes student admissions, academic grading, automated attendance with SMS alerts, online fee collection with bKash/Nagad reconciliation, and comprehensive administrative reporting.',
      targetAudience: 'Schools, colleges, universities, madrasas, and multi-branch coaching institutions across Bangladesh.',
      problemsAddressed: 'Paper registers, manual attendance tracking, misplaced student records, physical fee collection queues, and disconnected parent communication.',
      mainPurpose: 'To provide a unified, automated, and secure digital campus operating system that eliminates administrative friction.',
      productType: 'Education ERP / SaaS',
      stage: LaunchStage.LIVE,
      status: ContentStatus.PUBLISHED,
      isFeatured: true,
      showOnHomepage: true,
      showOnProductsPage: true,
      showInNavDropdown: true,
      allowPublicDetail: true,
      enableGallery: true,
      enableCaseStudies: true,
      enableDemos: true,
      enableFaq: true,
      displayOrder: 1,
      homepageOrder: 1,
      navOrder: 1,
      featuredOrder: 1,
      categoryId: catEdu.id,
      brandColor: '#2563EB',
      seoTitle: 'EduManage BD | Education Management ERP & Digital School Software',
      seoDescription: 'Complete cloud-native education management software for schools and colleges in Bangladesh. Digital attendance, fee collection, and grade tabulation.',
      canonicalUrl: 'https://mrminfotech.com/products/edumanage-bd',
    },
  });

  // Re-sync EduManage Sub-collections
  await prisma.productMediaItem.deleteMany({ where: { productId: edu.id } });
  await prisma.productMediaItem.createMany({
    data: [
      {
        productId: edu.id,
        url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'DASHBOARD',
        title: 'Executive Administration Console',
        caption: 'Centralized institutional metrics, active enrollments, and daily fee collections.',
        altText: 'EduManage BD Administration Dashboard screenshot',
        isPrimary: true,
        displayOrder: 1,
      },
      {
        productId: edu.id,
        url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'SCREENSHOT',
        title: 'Examination & Grade Tabulation Interface',
        caption: 'Automated GPA calculation and official transcript generator.',
        altText: 'EduManage BD Grading and Tabulation interface',
        isPrimary: false,
        displayOrder: 2,
      },
      {
        productId: edu.id,
        url: 'https://res.cloudinary.com/dblbl3cmk/image/upload/v1793826130/mrm-assets/isgywnylygo4dizwncqu.jpg',
        mediaType: 'MOBILE',
        title: 'Guardian Mobile Notification App',
        caption: 'Instant SMS attendance, class notices, and tuition payment gateway.',
        altText: 'EduManage BD Guardian Mobile Application',
        isPrimary: false,
        displayOrder: 3,
      },
    ],
  });

  await prisma.productFeatureItem.deleteMany({ where: { productId: edu.id } });
  await prisma.productFeatureItem.createMany({
    data: [
      {
        productId: edu.id,
        title: 'Student Lifecycle Management',
        shortDescription: 'Admissions, class assignments, digital ID cards, and cumulative academic history.',
        categoryName: 'Core Features',
        icon: 'Users',
        isFeatured: true,
        displayOrder: 1,
      },
      {
        productId: edu.id,
        title: 'Biometric & RFID Attendance',
        shortDescription: 'Hardware telemetry integration with automated SMS alerts dispatched to guardians upon arrival.',
        categoryName: 'Automation',
        icon: 'Activity',
        isFeatured: true,
        displayOrder: 2,
      },
      {
        productId: edu.id,
        title: 'Digital Fees & Auto-Reconciliation',
        shortDescription: 'Tuition fee generation with mobile financial service (bKash, Nagad) auto-reconciliation.',
        categoryName: 'Financial Management',
        icon: 'CreditCard',
        isFeatured: true,
        displayOrder: 3,
      },
      {
        productId: edu.id,
        title: 'Exam Tabulation & Dynamic GPA',
        shortDescription: 'Dynamic automated GPA calculation and printable official academic transcripts.',
        categoryName: 'Academic',
        icon: 'Award',
        isFeatured: true,
        displayOrder: 4,
      },
      {
        productId: edu.id,
        title: 'Parent & Student Portal',
        shortDescription: 'Real-time access to attendance, exam results, announcements, and fee payment histories.',
        categoryName: 'Mobile Experience',
        icon: 'Smartphone',
        isFeatured: false,
        displayOrder: 5,
      },
      {
        productId: edu.id,
        title: 'Role-Based Staff Access & Audit',
        shortDescription: 'Granular permissions for teachers, accountants, librarians, and system administrators.',
        categoryName: 'Security',
        icon: 'ShieldCheck',
        isFeatured: false,
        displayOrder: 6,
      },
    ],
  });

  await prisma.productBenefit.deleteMany({ where: { productId: edu.id } });
  await prisma.productBenefit.createMany({
    data: [
      {
        productId: edu.id,
        title: 'Zero Cash Leakage',
        description: '100% transparent fee reconciliation directly to institutional bank accounts with instant receipts.',
        icon: 'CheckCircle2',
        displayOrder: 1,
      },
      {
        productId: edu.id,
        title: '80% Time Saved in Grading',
        description: 'Instant report card preparation and tabulation with custom GPA grading rules.',
        icon: 'Clock',
        displayOrder: 2,
      },
      {
        productId: edu.id,
        title: 'Instant Guardian Trust',
        description: 'Automated SMS alerts for attendance and emergency institutional notifications.',
        icon: 'HeartHandshake',
        displayOrder: 3,
      },
      {
        productId: edu.id,
        title: 'Zero Server Maintenance',
        description: 'Fully managed cloud infrastructure with automated daily backups and zero hardware costs.',
        icon: 'Cloud',
        displayOrder: 4,
      },
    ],
  });

  await prisma.productLink.deleteMany({ where: { productId: edu.id } });
  await prisma.productLink.createMany({
    data: [
      {
        productId: edu.id,
        title: 'Official Website',
        url: 'https://edumanagebd.com',
        linkType: 'OFFICIAL_WEBSITE',
        openInNewTab: true,
        isVisible: true,
        displayOrder: 1,
      },
      {
        productId: edu.id,
        title: 'Request a Live Demo',
        url: '/contact?subject=EduManage%20BD%20Live%20Demo',
        linkType: 'REQUEST_DEMO',
        openInNewTab: false,
        isVisible: true,
        displayOrder: 2,
      },
    ],
  });

  await prisma.productDemonstration.deleteMany({ where: { productId: edu.id } });
  await prisma.productDemonstration.createMany({
    data: [
      {
        productId: edu.id,
        title: 'Main Administrator Command Dashboard',
        description: 'Comprehensive overview of daily attendance, fee collections, and active academic sessions.',
        demoType: 'DASHBOARD',
        mediaUrl: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200&auto=format&fit=crop',
        displayOrder: 1,
      },
      {
        productId: edu.id,
        title: 'Examination Tabulation Grid',
        description: 'Fast grade entry and automated GPA calculation for single and multi-term academic exams.',
        demoType: 'INTERFACE',
        mediaUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop',
        displayOrder: 2,
      },
    ],
  });

  await prisma.productFaqItem.deleteMany({ where: { productId: edu.id } });
  await prisma.productFaqItem.createMany({
    data: [
      {
        productId: edu.id,
        question: 'Can EduManage BD integrate with our existing RFID attendance gates?',
        answer: 'Yes. EduManage BD provides standard API integrations and telemetry agents for common biometric and RFID devices.',
        displayOrder: 1,
      },
      {
        productId: edu.id,
        question: 'Does it support local payment gateways like bKash and Nagad?',
        answer: 'Yes, it supports direct automated payment reconciliation with bKash, Nagad, and local Bangladeshi banking channels.',
        displayOrder: 2,
      },
      {
        productId: edu.id,
        question: 'Is student and academic data secure?',
        answer: 'All data is hosted on secure cloud infrastructure with encrypted daily backups and strict role-based access control.',
        displayOrder: 3,
      },
    ],
  });

  console.log('✅ EduManage BD enriched successfully.');

  // 3. MediSheba BD
  const med = await prisma.product.upsert({
    where: { slug: 'medisheba-bd' },
    update: {
      title: 'MediSheba BD',
      tagline: 'Integrated Clinical, Diagnostic & Hospital Management System',
      shortDescription: 'Secure healthcare management system connecting clinics, diagnostic centers, doctors, and patients.',
      description: 'MediSheba BD is a high-reliability clinical and diagnostic management platform engineered to automate patient registrations, laboratory test workflows, barcode specimen tracking, doctor appointments, and diagnostic reporting.',
      targetAudience: 'Diagnostic centres, specialized clinics, private hospitals, doctors, and laboratory chains.',
      problemsAddressed: 'Handwritten test reports, lost pathology specimens, double booking of doctor appointments, and lack of patient medical history.',
      mainPurpose: 'To modernize clinical diagnostics, ensure zero specimen mix-ups, and deliver rapid digital test delivery.',
      productType: 'Healthcare ERP / SaaS',
      stage: LaunchStage.LIVE,
      status: ContentStatus.PUBLISHED,
      isFeatured: true,
      showOnHomepage: true,
      showOnProductsPage: true,
      showInNavDropdown: true,
      allowPublicDetail: true,
      enableGallery: true,
      enableCaseStudies: true,
      enableDemos: true,
      enableFaq: true,
      displayOrder: 2,
      homepageOrder: 2,
      navOrder: 2,
      featuredOrder: 2,
      categoryId: catHealth.id,
      brandColor: '#0EA5E9',
      seoTitle: 'MediSheba BD | Clinical & Diagnostic Centre Management Software',
      seoDescription: 'Cloud diagnostic centre and clinic management system. Barcode pathology tracking, digital reporting, and patient appointment scheduling.',
      canonicalUrl: 'https://mrminfotech.com/products/medisheba-bd',
    },
    create: {
      slug: 'medisheba-bd',
      title: 'MediSheba BD',
      tagline: 'Integrated Clinical, Diagnostic & Hospital Management System',
      shortDescription: 'Secure healthcare management system connecting clinics, diagnostic centers, doctors, and patients.',
      description: 'MediSheba BD is a high-reliability clinical and diagnostic management platform engineered to automate patient registrations, laboratory test workflows, barcode specimen tracking, doctor appointments, and diagnostic reporting.',
      targetAudience: 'Diagnostic centres, specialized clinics, private hospitals, doctors, and laboratory chains.',
      problemsAddressed: 'Handwritten test reports, lost pathology specimens, double booking of doctor appointments, and lack of patient medical history.',
      mainPurpose: 'To modernize clinical diagnostics, ensure zero specimen mix-ups, and deliver rapid digital test delivery.',
      productType: 'Healthcare ERP / SaaS',
      stage: LaunchStage.LIVE,
      status: ContentStatus.PUBLISHED,
      isFeatured: true,
      showOnHomepage: true,
      showOnProductsPage: true,
      showInNavDropdown: true,
      allowPublicDetail: true,
      enableGallery: true,
      enableCaseStudies: true,
      enableDemos: true,
      enableFaq: true,
      displayOrder: 2,
      homepageOrder: 2,
      navOrder: 2,
      featuredOrder: 2,
      categoryId: catHealth.id,
      brandColor: '#0EA5E9',
      seoTitle: 'MediSheba BD | Clinical & Diagnostic Centre Management Software',
      seoDescription: 'Cloud diagnostic centre and clinic management system. Barcode pathology tracking, digital reporting, and patient appointment scheduling.',
      canonicalUrl: 'https://mrminfotech.com/products/medisheba-bd',
    },
  });

  // Re-sync MediSheba Sub-collections
  await prisma.productMediaItem.deleteMany({ where: { productId: med.id } });
  await prisma.productMediaItem.createMany({
    data: [
      {
        productId: med.id,
        url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'DASHBOARD',
        title: 'Diagnostic Reception & Billing Console',
        caption: 'Rapid patient registration, test package selection, and instant barcode receipt generation.',
        altText: 'MediSheba BD Billing Console',
        isPrimary: true,
        displayOrder: 1,
      },
      {
        productId: med.id,
        url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'INTERFACE',
        title: 'Pathology Verification & Reporting Workspace',
        caption: 'Standardized pathology templates with digital pathologist sign-off.',
        altText: 'MediSheba BD Pathology interface',
        isPrimary: false,
        displayOrder: 2,
      },
    ],
  });

  await prisma.productFeatureItem.deleteMany({ where: { productId: med.id } });
  await prisma.productFeatureItem.createMany({
    data: [
      {
        productId: med.id,
        title: 'Barcode Specimen Tracking',
        shortDescription: 'Unique barcode generation for sample tubes preventing patient specimen misidentification.',
        categoryName: 'Diagnostic Lab',
        icon: 'QrCode',
        isFeatured: true,
        displayOrder: 1,
      },
      {
        productId: med.id,
        title: 'Pathology & Radiology Reporting',
        shortDescription: 'Predefined standardized report templates with digital pathologist sign-off.',
        categoryName: 'Core Features',
        icon: 'FileText',
        isFeatured: true,
        displayOrder: 2,
      },
      {
        productId: med.id,
        title: 'Doctor Chamber & Appointments',
        shortDescription: 'Streamlined appointment queuing, doctor fees management, and prescription generation.',
        categoryName: 'Clinical',
        icon: 'Stethoscope',
        isFeatured: true,
        displayOrder: 3,
      },
      {
        productId: med.id,
        title: 'Patient SMS Report Portal',
        shortDescription: 'Instant SMS report download links allowing patients to view and print reports remotely.',
        categoryName: 'Patient Experience',
        icon: 'MessageSquare',
        isFeatured: false,
        displayOrder: 4,
      },
      {
        productId: med.id,
        title: 'Pharmacy & Stock Management',
        shortDescription: 'Batch tracking, expiry alerts, and stock reconciliation for in-house pharmacies.',
        categoryName: 'Inventory',
        icon: 'Package',
        isFeatured: false,
        displayOrder: 5,
      },
      {
        productId: med.id,
        title: 'Cryptographic Health Records Privacy',
        shortDescription: 'Strict cryptographic data protection and audit logs for all patient health records.',
        categoryName: 'Security',
        icon: 'ShieldCheck',
        isFeatured: false,
        displayOrder: 6,
      },
    ],
  });

  await prisma.productBenefit.deleteMany({ where: { productId: med.id } });
  await prisma.productBenefit.createMany({
    data: [
      {
        productId: med.id,
        title: 'Zero Specimen Mix-ups',
        description: 'Barcoded specimen workflow ensures end-to-end traceability from collection to finalized report.',
        icon: 'CheckCircle2',
        displayOrder: 1,
      },
      {
        productId: med.id,
        title: '60% Faster Report Delivery',
        description: 'Direct SMS delivery links reduce physical report collection counter crowds significantly.',
        icon: 'Zap',
        displayOrder: 2,
      },
      {
        productId: med.id,
        title: 'Revenue Leak Prevention',
        description: 'Real-time daily financial cashier summaries and automated referral commission accounting.',
        icon: 'TrendingUp',
        displayOrder: 3,
      },
      {
        productId: med.id,
        title: 'Multi-Branch Administration',
        description: 'Manage multiple diagnostic branches and collection booths from one unified console.',
        icon: 'Building',
        displayOrder: 4,
      },
    ],
  });

  await prisma.productLink.deleteMany({ where: { productId: med.id } });
  await prisma.productLink.createMany({
    data: [
      {
        productId: med.id,
        title: 'Official Website',
        url: 'https://medishebabd.com',
        linkType: 'OFFICIAL_WEBSITE',
        openInNewTab: true,
        isVisible: true,
        displayOrder: 1,
      },
      {
        productId: med.id,
        title: 'Request a Live Demo',
        url: '/contact?subject=MediSheba%20BD%20Live%20Demo',
        linkType: 'REQUEST_DEMO',
        openInNewTab: false,
        isVisible: true,
        displayOrder: 2,
      },
    ],
  });

  await prisma.productDemonstration.deleteMany({ where: { productId: med.id } });
  await prisma.productDemonstration.createMany({
    data: [
      {
        productId: med.id,
        title: 'Diagnostic Reception & Billing',
        description: 'Rapid patient registration, test package selection, and automatic barcode sticker printing.',
        demoType: 'DASHBOARD',
        mediaUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1200&auto=format&fit=crop',
        displayOrder: 1,
      },
      {
        productId: med.id,
        title: 'Pathology Result Verification Workspace',
        description: 'Multi-parameter test verification interface with historical results comparison.',
        demoType: 'INTERFACE',
        mediaUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1200&auto=format&fit=crop',
        displayOrder: 2,
      },
    ],
  });

  await prisma.productFaqItem.deleteMany({ where: { productId: med.id } });
  await prisma.productFaqItem.createMany({
    data: [
      {
        productId: med.id,
        question: 'Can patients download test reports from home?',
        answer: 'Yes. As soon as the pathologist approves the report, a secure SMS link is delivered to the patient phone.',
        displayOrder: 1,
      },
      {
        productId: med.id,
        question: 'Does MediSheba BD support auto-analyzer machine interfacing?',
        answer: 'Yes. We support unidirectional and bidirectional interfacing with common auto-analyzers and laboratory machines.',
        displayOrder: 2,
      },
    ],
  });

  console.log('✅ MediSheba BD enriched successfully.');

  // 4. MRM Multi-Institution Website Platform
  const inst = await prisma.product.upsert({
    where: { slug: 'multi-institution-platform' },
    update: {
      title: 'MRM Multi-Institution Website Platform',
      tagline: 'Enterprise Multi-Tenant Website & Portal Management Engine',
      shortDescription: 'Scalable multi-tenant governance platform engineered for chain institutions, educational groups, and enterprise conglomerates.',
      description: 'A centralized web ecosystem that empowers group administrators to deploy, configure, and maintain individual branded websites for tens or hundreds of branch institutions from a single central master dashboard.',
      targetAudience: 'School chains, university clusters, corporate groups, and multi-branch organizations.',
      problemsAddressed: 'Disorganized branch websites, disparate domain management, high recurring development costs, and inconsistent brand identity.',
      mainPurpose: 'To enable centralized brand governance and content syndication while giving individual branches autonomous publishing capabilities.',
      productType: 'Website Platform / SaaS',
      stage: LaunchStage.LIVE,
      status: ContentStatus.PUBLISHED,
      isFeatured: false,
      showOnHomepage: true,
      showOnProductsPage: true,
      showInNavDropdown: true,
      allowPublicDetail: true,
      enableGallery: true,
      enableCaseStudies: true,
      enableDemos: true,
      enableFaq: true,
      displayOrder: 3,
      homepageOrder: 3,
      navOrder: 3,
      featuredOrder: 3,
      categoryId: catInst.id,
      brandColor: '#10B981',
      seoTitle: 'Multi-Institution Website Platform | Centralized Branch Portal CMS',
      seoDescription: 'Enterprise multi-tenant website platform for school chains and multi-branch groups. Centralized branding, independent branch sub-sites, and unified CMS.',
      canonicalUrl: 'https://mrminfotech.com/products/multi-institution-platform',
    },
    create: {
      slug: 'multi-institution-platform',
      title: 'MRM Multi-Institution Website Platform',
      tagline: 'Enterprise Multi-Tenant Website & Portal Management Engine',
      shortDescription: 'Scalable multi-tenant governance platform engineered for chain institutions, educational groups, and enterprise conglomerates.',
      description: 'A centralized web ecosystem that empowers group administrators to deploy, configure, and maintain individual branded websites for tens or hundreds of branch institutions from a single central master dashboard.',
      targetAudience: 'School chains, university clusters, corporate groups, and multi-branch organizations.',
      problemsAddressed: 'Disorganized branch websites, disparate domain management, high recurring development costs, and inconsistent brand identity.',
      mainPurpose: 'To enable centralized brand governance and content syndication while giving individual branches autonomous publishing capabilities.',
      productType: 'Website Platform / SaaS',
      stage: LaunchStage.LIVE,
      status: ContentStatus.PUBLISHED,
      isFeatured: false,
      showOnHomepage: true,
      showOnProductsPage: true,
      showInNavDropdown: true,
      allowPublicDetail: true,
      enableGallery: true,
      enableCaseStudies: true,
      enableDemos: true,
      enableFaq: true,
      displayOrder: 3,
      homepageOrder: 3,
      navOrder: 3,
      featuredOrder: 3,
      categoryId: catInst.id,
      brandColor: '#10B981',
      seoTitle: 'Multi-Institution Website Platform | Centralized Branch Portal CMS',
      seoDescription: 'Enterprise multi-tenant website platform for school chains and multi-branch groups. Centralized branding, independent branch sub-sites, and unified CMS.',
      canonicalUrl: 'https://mrminfotech.com/products/multi-institution-platform',
    },
  });

  // Re-sync Multi-Institution Sub-collections
  await prisma.productMediaItem.deleteMany({ where: { productId: inst.id } });
  await prisma.productMediaItem.createMany({
    data: [
      {
        productId: inst.id,
        url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'DASHBOARD',
        title: 'Master Multi-Tenant Governance Console',
        caption: 'View, monitor, and configure all branch websites from a single command dashboard.',
        altText: 'Multi-Institution Central Console',
        isPrimary: true,
        displayOrder: 1,
      },
      {
        productId: inst.id,
        url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'INTERFACE',
        title: 'Branch Portal Customizer',
        caption: 'Visual configuration of branch notices, hero media, and principal message blocks.',
        altText: 'Branch Portal Customizer',
        isPrimary: false,
        displayOrder: 2,
      },
    ],
  });

  await prisma.productFeatureItem.deleteMany({ where: { productId: inst.id } });
  await prisma.productFeatureItem.createMany({
    data: [
      {
        productId: inst.id,
        title: 'Instant Branch Portal Provisioning',
        shortDescription: 'Deploy fully functional branded sub-sites with custom domain or subdomain mapping in minutes.',
        categoryName: 'Core Features',
        icon: 'Globe',
        isFeatured: true,
        displayOrder: 1,
      },
      {
        productId: inst.id,
        title: 'Group-Wide Content Syndication',
        shortDescription: 'Publish urgent emergency notices or group announcements across all branch portals simultaneously.',
        categoryName: 'Content Management',
        icon: 'Layers',
        isFeatured: true,
        displayOrder: 2,
      },
      {
        productId: inst.id,
        title: 'Centralized Brand Governance',
        shortDescription: 'Enforce brand colors, logos, and typography while allowing branches autonomous local posting.',
        categoryName: 'Branding',
        icon: 'Palette',
        isFeatured: true,
        displayOrder: 3,
      },
      {
        productId: inst.id,
        title: 'Autonomous Branch Staff Roles',
        shortDescription: 'Granular permissions allowing local teachers and principals to manage local galleries and events.',
        categoryName: 'User Management',
        icon: 'Users',
        isFeatured: false,
        displayOrder: 4,
      },
      {
        productId: inst.id,
        title: 'Global Cloud Edge Caching',
        shortDescription: 'Sub-second page loads even during high-traffic exam results or admission cycles.',
        categoryName: 'Performance',
        icon: 'Zap',
        isFeatured: false,
        displayOrder: 5,
      },
      {
        productId: inst.id,
        title: 'Standardized SEO & Accessibility',
        shortDescription: 'Automated sitemaps, structured schemas, and WCAG accessibility across all branches.',
        categoryName: 'SEO & Quality',
        icon: 'Search',
        isFeatured: false,
        displayOrder: 6,
      },
    ],
  });

  await prisma.productBenefit.deleteMany({ where: { productId: inst.id } });
  await prisma.productBenefit.createMany({
    data: [
      {
        productId: inst.id,
        title: '90% Web Cost Savings',
        description: 'Eliminates redundant development and maintenance costs of dozens of isolated websites.',
        icon: 'CheckCircle2',
        displayOrder: 1,
      },
      {
        productId: inst.id,
        title: 'Instant Notice Broadcasting',
        description: 'Syndicate group updates across 100+ branches with a single click.',
        icon: 'Zap',
        displayOrder: 2,
      },
      {
        productId: inst.id,
        title: '100% Brand Integrity',
        description: 'No unauthorized layout distortions or outdated logos on branch portals.',
        icon: 'ShieldCheck',
        displayOrder: 3,
      },
      {
        productId: inst.id,
        title: 'Unified Security Architecture',
        description: 'Enterprise SSL, DDoS protection, and cloud monitoring protecting all branch domains.',
        icon: 'Lock',
        displayOrder: 4,
      },
    ],
  });

  await prisma.productLink.deleteMany({ where: { productId: inst.id } });
  await prisma.productLink.createMany({
    data: [
      {
        productId: inst.id,
        title: 'Official Platform Page',
        url: 'https://mrminfotech.com/products/multi-institution-platform',
        linkType: 'OFFICIAL_WEBSITE',
        openInNewTab: false,
        isVisible: true,
        displayOrder: 1,
      },
      {
        productId: inst.id,
        title: 'Discuss Enterprise Setup',
        url: '/contact?subject=Multi-Institution%20Platform%20Enterprise',
        linkType: 'REQUEST_DEMO',
        openInNewTab: false,
        isVisible: true,
        displayOrder: 2,
      },
    ],
  });

  await prisma.productDemonstration.deleteMany({ where: { productId: inst.id } });
  await prisma.productDemonstration.createMany({
    data: [
      {
        productId: inst.id,
        title: 'Master Multi-Tenant Console',
        description: 'View, monitor, and configure all branch websites from a single command dashboard.',
        demoType: 'DASHBOARD',
        mediaUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop',
        displayOrder: 1,
      },
      {
        productId: inst.id,
        title: 'Branch Portal Customizer',
        description: 'Visual configuration of branch notices, hero media, and principal message blocks.',
        demoType: 'INTERFACE',
        mediaUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop',
        displayOrder: 2,
      },
    ],
  });

  await prisma.productFaqItem.deleteMany({ where: { productId: inst.id } });
  await prisma.productFaqItem.createMany({
    data: [
      {
        productId: inst.id,
        question: 'Can individual branches use their own custom .edu.bd or .ac.bd domains?',
        answer: 'Yes. The platform supports custom domains with automated SSL certificate provisioning for each branch.',
        displayOrder: 1,
      },
      {
        productId: inst.id,
        question: 'How many branch websites can be hosted on a single cluster?',
        answer: 'The architecture scales horizontally and can host hundreds of connected branch sites without performance degradation.',
        displayOrder: 2,
      },
    ],
  });

  console.log('✅ MRM Multi-Institution Platform enriched successfully.');
  console.log('🎉 [Safe Seed Completed]: All 3 Products now have rich relational entities!');
}

main()
  .catch((e) => {
    console.error('❌ Error in safe seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

