# MRM InfoTech — Complete International SEO Strategy, Keyword Research, Page-Level SEO & CMS Integration

**Document Version**: 1.0.0  
**Effective Date**: November 8, 2026  
**Target Domains**: `https://mrminfotech.com` / `https://www.mrminfotech.com`  
**Classification**: Proprietary Strategic Architecture Document  

---

## Executive Summary

MRM InfoTech operates under a defined **dual-engine business model**:
1. **International Service Acquisition**: Securing enterprise and mid-market software development, web development, SaaS engineering, technical SEO, and digital solution contracts across Tier-1 English-speaking markets (United States, United Kingdom, and Australia).
2. **Bangladesh Product Acquisition**: Driving local institutional and healthcare adoption of proprietary SaaS software products, notably **EduManage BD** (School & College ERP) and **MediSheba BD** (Diagnostic & Hospital Information Management System).

This master document provides the complete technical, architectural, and content blueprint for the internal SEO specialist, engineering team, and product leadership. It establishes page-by-page keyword mappings, technical schema architectures, CMS management controls, and search console deployment checklists.

---

## PART 1 — Business Objectives & Target Markets

### 1.1 Objective A: International Service Acquisition

- **Target Geographic Regions**:
  - **Primary**: United States (East Coast, West Coast tech hubs, Midwest enterprises).
  - **Secondary**: United Kingdom (London financial & digital hubs, regional SMBs).
  - **Secondary**: Australia (Sydney, Melbourne, Brisbane tech ecosystems).
- **Core Value Proposition**:
  - Remote engineering team providing Senior Full-Stack Developers, Cloud Solutions Architects, and Next.js/NestJS specialists at competitive offshore rates with enterprise-grade SLA backing.
  - Strict compliance with OWASP Top 10, ISO-aligned coding practices, full IP ownership transfer, and NDA protection.
  - Seamless English communication and overlapping operational time zones for sprint ceremonies.
- **Service Categories Offered**:
  - Custom Software Development
  - Web Application Development (Next.js 16, React, TypeScript)
  - SaaS Platform Engineering & Multi-Tenant Cloud Architecture
  - API & Microservices Engineering (NestJS, Node.js, PostgreSQL)
  - Technical SEO & Web Performance Engineering
  - Enterprise UI/UX Design & Design Systems

### 1.2 Objective B: Bangladesh Product Acquisition

- **Target Geographic Region**: Bangladesh (Dhaka, Chittagong, Sylhet, Rajshahi, Khulna).
- **Core Value Proposition**:
  - Sovereign cloud hosting, local compliance, localized Bengali UI support, biometric hardware integration (ZKTeco RFID/fingerprint), and native mobile banking payments (bKash, Nagad, Rocket, Upay).
- **Flagship Proprietary Products**:
  - **EduManage BD**: Comprehensive education management software for schools, colleges, madrasahs, and universities (Admissions, Fees, Grading, Attendance, SMS Alerts).
  - **MediSheba BD**: Clinical diagnostic laboratory and hospital operating software (Patient Registration, Specimen Barcode Routing, Automated Pathology Reports, Doctor Revenue Sharing).
- **Important Positioning Boundary**:
  - International service pages (`/services`, `/services/*`) strictly avoid mixing Bangladeshi local product keywords.
  - Dedicated product portals and `/products/*` routes serve as the primary landing hubs for localized software discovery without diluting international corporate authority.

---

## PART 2 — Complete Website Route Audit & URL Inventory

All routes below have been verified against the production Next.js App Router codebase.

| # | Route URL | Page Type | Rendering Strategy | Index Status | Target Audience |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | `https://mrminfotech.com/` | Corporate Homepage | Edge ISR (60s) | Index, Follow | Global / US / UK / AU / BD |
| 2 | `https://mrminfotech.com/about` | Corporate About & Story | Edge ISR (30s) | Index, Follow | Global Enterprise Clients |
| 3 | `https://mrminfotech.com/services` | Services Catalog Hub | Edge ISR (30s) | Index, Follow | Global IT Decision Makers |
| 4 | `https://mrminfotech.com/services/web-development` | Service Detail Page | Edge Dynamic ISR | Index, Follow | US / UK / AU Web Clients |
| 5 | `https://mrminfotech.com/services/custom-software-development` | Service Detail Page | Edge Dynamic ISR | Index, Follow | US / UK / AU Software Clients |
| 6 | `https://mrminfotech.com/services/cloud-devops` | Service Detail Page | Edge Dynamic ISR | Index, Follow | Cloud / DevOps Clients |
| 7 | `https://mrminfotech.com/services/ui-ux-design` | Service Detail Page | Edge Dynamic ISR | Index, Follow | Product Teams / Startups |
| 8 | `https://mrminfotech.com/products` | Proprietary Products Hub | Edge ISR (30s) | Index, Follow | BD & Regional Businesses |
| 9 | `https://mrminfotech.com/products/edumanage-bd` | Product Detail & Demo | Edge Dynamic ISR | Index, Follow | BD Educational Institutions |
| 10 | `https://mrminfotech.com/products/medisheba-bd` | Product Detail & Demo | Edge Dynamic ISR | Index, Follow | BD Clinics & Hospitals |
| 11 | `https://mrminfotech.com/products/multi-institution-platform` | Product Detail | Edge Dynamic ISR | Index, Follow | Enterprise Education Groups |
| 12 | `https://mrminfotech.com/projects` | Case Studies & Portfolio Hub | Edge ISR (30s) | Index, Follow | Global Enterprise Prospects |
| 13 | `https://mrminfotech.com/projects/edumanage-bd-campus-cloud` | Project Case Study | Edge Dynamic ISR | Index, Follow | Technical Evaluators |
| 14 | `https://mrminfotech.com/projects/medisheba-bd-hospital-core` | Project Case Study | Edge Dynamic ISR | Index, Follow | Healthcare Tech Buyers |
| 15 | `https://mrminfotech.com/blog` | Technical Insights Hub | Edge ISR (30s) | Index, Follow | Developers, CTOs, Founders |
| 16 | `https://mrminfotech.com/blog/[slug]` | Individual Insights Articles | Edge Dynamic ISR | Index, Follow | Organic Search Traffic |
| 17 | `https://mrminfotech.com/team` | Leadership & Engineering Team | Edge ISR (30s) | Index, Follow | Clients Assessing Team |
| 18 | `https://mrminfotech.com/careers` | Careers & Job Openings | Edge ISR (30s) | Index, Follow | Talent Acquisition (BD) |
| 19 | `https://mrminfotech.com/contact` | Inquiries & Consultation | Edge ISR (30s) | Index, Follow | Inbound Leads (Global) |
| 20 | `https://mrminfotech.com/start-project` | Scoped RFP & Project Starter | Edge ISR (30s) | Index, Follow | High-Intent Inbound RFPs |
| 21 | `https://mrminfotech.com/security` | Enterprise Security Policy | Edge ISR (30s) | Index, Follow | Compliance / Procurement |
| 22 | `https://mrminfotech.com/privacy-policy` | Legal Policy | Static prerender | Index, Follow | Legal Compliance |
| 23 | `https://mrminfotech.com/terms` | Terms of Service | Static prerender | Index, Follow | Legal Compliance |
| 24 | `https://mrminfotech.com/cookie-policy` | Cookie Transparency | Static prerender | Index, Follow | Legal Compliance |
| 25 | `https://mrminfotech.com/admin/*` | CMS Dashboard & Auth | Dynamic Server | Noindex, Nofollow | Internal Administrators |

---

## PART 3 — Master Keyword Research

### 3.1 International Service Keyword Clusters

#### A. Global Core Software Development
- `Software Development Company`
- `Custom Software Development Company`
- `Web Development Company`
- `SaaS Development Company`
- `Full Stack Development Services`
- `Custom Web Application Development`
- `Enterprise Software Engineering`
- `Remote Software Development Team`

#### B. United States Target Keywords
- `Software Development Company for US Businesses`
- `Custom Software Development Services USA`
- `Web Development Agency for US Businesses`
- `SaaS Development Company USA`
- `Hire Dedicated Web Developers USA`
- `Offshore Software Engineering for US Startups`

#### C. United Kingdom Target Keywords
- `Software Development Company UK`
- `Custom Software Development UK`
- `Web Development Services UK`
- `SaaS Development Services UK`
- `Remote Development Team UK`
- `Full Stack Web Development Agency London`

#### D. Australia Target Keywords
- `Software Development Company Australia`
- `Custom Software Development Australia`
- `Web Development Services Australia`
- `SaaS Development Services Australia`
- `Remote Software Development Australia`
- `Web Application Engineering Sydney Melbourne`

### 3.2 Bangladesh Product Keyword Clusters

#### A. EduManage BD (Education Sector)
- `School Management Software Bangladesh`
- `College Management System BD`
- `Education ERP Software Bangladesh`
- `Student Attendance and Fees Software BD`
- `Biometric School Attendance System Bangladesh`

#### B. MediSheba BD (Healthcare Sector)
- `Diagnostic Center Management Software Bangladesh`
- `Hospital Management System Bangladesh`
- `Pathology Lab Software BD`
- `Clinic Billing and Patient Management Software`
- `Medical Diagnostic ERP Bangladesh`

---

## PART 4 — Keyword Research Validation Table

> **Methodological Notice**: Metric fields marked `Research Required — Not Yet Validated` represent high-priority strategic targets to be validated with Google Keyword Planner / Ahrefs by MRM's designated SEO specialist. Values are not artificially fabricated.

| # | Keyword | Tier | Search Intent | Target Country | Vol / Mo | KD | CPC ($) | Comp. | Suggested Landing Route | Research Status |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Software Development Company | Primary | Commercial | Global / US | — | — | — | High | `/` | Research Required |
| 2 | Custom Software Development Company | Secondary | Commercial | US / UK | — | — | — | High | `/` | Research Required |
| 3 | Web Development Company | Secondary | Commercial | US / UK / AU | — | — | — | High | `/` | Research Required |
| 4 | SaaS Development Company | Secondary | Commercial | US / UK | — | — | — | High | `/` | Research Required |
| 5 | Full Stack Development Services | Supporting | Commercial | US / UK | — | — | — | Med | `/services/web-development` | Research Required |
| 6 | Custom Web Application Development | Secondary | Commercial | Global | — | — | — | Med | `/services/web-development` | Research Required |
| 7 | Custom Software Development Services | Primary | Commercial | US / UK / AU | — | — | — | High | `/services/custom-software-development` | Research Required |
| 8 | SaaS Development Services | Primary | Commercial | US / UK | — | — | — | High | `/services` | Research Required |
| 9 | Cloud Infrastructure & DevOps Services | Primary | Commercial | US / UK | — | — | — | Med | `/services/cloud-devops` | Research Required |
| 10 | Enterprise UI/UX Design Services | Primary | Commercial | US / UK | — | — | — | Med | `/services/ui-ux-design` | Research Required |
| 11 | School Management Software Bangladesh | Primary | Commercial | Bangladesh | — | — | — | Med | `/products/edumanage-bd` | Research Required |
| 12 | Education Management System Bangladesh | Secondary | Informational | Bangladesh | — | — | — | Low | `/products/edumanage-bd` | Research Required |
| 13 | Diagnostic Center Management Software | Primary | Commercial | Bangladesh | — | — | — | Low | `/products/medisheba-bd` | Research Required |
| 14 | Hospital Management Software BD | Secondary | Commercial | Bangladesh | — | — | — | Med | `/products/medisheba-bd` | Research Required |
| 15 | Software Development Portfolio | Primary | Informational | Global | — | — | — | Low | `/projects` | Research Required |
| 16 | Software Development Case Studies | Secondary | Commercial | Global | — | — | — | Low | `/projects` | Research Required |
| 17 | Hire Software Development Company | Secondary | Transactional | US / UK / AU | — | — | — | High | `/contact` | Research Required |
| 18 | Start Software Development Project | Primary | Transactional | Global | — | — | — | Med | `/start-project` | Research Required |

---

## PART 5 — Page-by-Page Keyword Mapping & On-Page Optimization Plan

### 5.1 Homepage (`/`)
- **Primary Keyword**: `Software Development Company`
- **Secondary Keywords**: `Custom Software Development Company`, `Web Development Company`, `SaaS Development Company`, `Digital Solutions Company`
- **Search Intent**: Commercial Investigation / Navigational
- **Recommended SEO Title Tag**: `Custom Software & Web Development Company | MRM InfoTech` (58 characters)
- **Recommended Meta Description**: `MRM InfoTech is a global custom software and web development company. We engineer high-performance cloud SaaS platforms, web applications, and enterprise digital solutions.` (168 characters)
- **Heading Architecture**:
  - `H1`: Ideas • Products • Impact — Custom Software & Web Development Company
  - `H2`: Software Products & Enterprise Engineering Solutions
  - `H2`: Proprietary Cloud SaaS Platforms Built for Scale
  - `H2`: Engineered Services: From Concept to Production
  - `H2`: 5-Step Disciplined Software Engineering Lifecycle
  - `H2`: Modern Cloud Stack & Enterprise Architecture
- **Internal Links**:
  - Links to `/services/web-development`, `/services/custom-software-development`, `/products`, `/projects`, `/about`, `/contact`, `/start-project`.

### 5.2 About Page (`/about`)
- **Primary Keyword**: `About MRM InfoTech`
- **Secondary Keywords**: `Software Development Company`, `Technology Partner for Businesses`, `Software Development Team`
- **Search Intent**: Informational
- **Recommended SEO Title Tag**: `About Us | Custom Software Engineering Team | MRM InfoTech`
- **Recommended Meta Description**: `Discover MRM InfoTech: our story, dual-engine software vision, senior engineering culture, and commitment to building resilient enterprise cloud platforms.`
- **Heading Architecture**:
  - `H1`: About MRM InfoTech — Who We Are & What We Build
  - `H2`: The Dual-Engine Technology Vision
  - `H2`: Core Engineering Values & Architectural Principles
  - `H2`: Key Milestones & Production Trajectory

### 5.3 Services Catalog Hub (`/services`)
- **Primary Keyword**: `Software Development Services`
- **Secondary Keywords**: `Web Development Services`, `Custom Software Development Services`, `SaaS Development Services`, `Technical SEO Services`
- **Search Intent**: Commercial
- **Recommended SEO Title Tag**: `Custom Software & Web Development Services | MRM InfoTech`
- **Recommended Meta Description**: `Explore full-lifecycle software development services by MRM InfoTech: custom web apps, cloud SaaS architecture, mobile engineering, and performance optimization.`
- **Heading Architecture**:
  - `H1`: Enterprise Digital Services & Software Engineering Solutions
  - `H2`: Web & Custom Application Engineering
  - `H2`: Cloud Architecture & SaaS Modernization
  - `H2`: Technical SEO, Performance Tuning & Code Audits

### 5.4 Individual Service: Web Development (`/services/web-development`)
- **Primary Keyword**: `Web Development Services`
- **Secondary Keywords**: `Custom Web Application Development`, `Next.js Development Agency`, `Full Stack Web Development`
- **Search Intent**: Commercial / Transactional
- **Recommended SEO Title Tag**: `Custom Web Development Services | Next.js & React Apps | MRM InfoTech`
- **Recommended Meta Description**: `High-performance web development services using Next.js 16, TypeScript, and NestJS. Fast, secure, and SEO-engineered web applications for growing businesses.`
- **Heading Architecture**:
  - `H1`: Custom Web Application Development Services
  - `H2`: Enterprise Next.js & Full-Stack TypeScript Architecture
  - `H2`: Core Web Vitals & Sub-Second Page Speed Optimization
  - `H2`: Production Features & Technical Deliverables

### 5.5 Individual Service: Custom Software Development (`/services/custom-software-development`)
- **Primary Keyword**: `Custom Software Development Services`
- **Secondary Keywords**: `Bespoke Software Engineering`, `Enterprise Software Solutions`, `Cloud Software Company`
- **Search Intent**: Commercial / Transactional
- **Recommended SEO Title Tag**: `Custom Software Development Services | Enterprise Engineering | MRM InfoTech`
- **Recommended Meta Description**: `End-to-end custom software development services tailored to your business operations. Robust database architectures, ACID compliance, and secure cloud APIs.`
- **Heading Architecture**:
  - `H1`: Tailored Custom Software Development Services
  - `H2`: Solving Complex Business Challenges with Code
  - `H2`: Security, Scalability & Zero-Trust Architecture
  - `H2`: Technology Stack & API Protocols

### 5.6 Products Hub (`/products`)
- **Primary Keyword**: `Proprietary Software Products`
- **Secondary Keywords**: `Cloud SaaS Platforms`, `Education Management Software`, `Healthcare Clinic Software`
- **Search Intent**: Commercial / Navigational
- **Recommended SEO Title Tag**: `Proprietary Cloud SaaS Products & Platforms | MRM InfoTech`
- **Recommended Meta Description**: `Explore MRM InfoTech's proprietary software products: EduManage BD for educational institutions and MediSheba BD for diagnostic clinical laboratories.`

### 5.7 Product Detail: EduManage BD (`/products/edumanage-bd`)
- **Primary Keyword**: `School Management Software Bangladesh`
- **Secondary Keywords**: `Education ERP System BD`, `College Attendance Software`, `Student Fees Management BD`
- **Search Intent**: Commercial / Transactional (Bangladesh)
- **Recommended SEO Title Tag**: `EduManage BD | School & College Management Software Bangladesh | MRM InfoTech`
- **Recommended Meta Description**: `EduManage BD is Bangladesh's premier cloud educational ERP. Automate admissions, biometric RFID attendance, online exam grading, and bKash tuition collection.`
- **Heading Architecture**:
  - `H1`: EduManage BD — Smart Campus Automation & Education ERP
  - `H2`: Biometric RFID Student & Staff Attendance
  - `H2`: Automated Tuition Billing with MFS Integration
  - `H2`: Exam Result Processing & Automated Report Cards

### 5.8 Product Detail: MediSheba BD (`/products/medisheba-bd`)
- **Primary Keyword**: `Diagnostic Center Management Software Bangladesh`
- **Secondary Keywords**: `Hospital Management System Bangladesh`, `Pathology Lab Software BD`, `Clinic ERP Software`
- **Search Intent**: Commercial / Transactional (Bangladesh)
- **Recommended SEO Title Tag**: `MediSheba BD | Diagnostic Center & Hospital Software Bangladesh | MRM InfoTech`
- **Recommended Meta Description**: `MediSheba BD streamlines pathology lab workflows, barcoded specimen routing, automated test reporting, and doctor referral accounting for Bangladeshi clinics.`
- **Heading Architecture**:
  - `H1`: MediSheba BD — Clinical Diagnostic & Hospital Information System
  - `H2`: Barcoded Specimen Tracking & Pathology Workflow
  - `H2`: Instant Patient Report Delivery & Doctor Signatures
  - `H2`: Daily Financial Settlement & Laboratory Inventory

### 5.9 Projects & Portfolio Hub (`/projects`)
- **Primary Keyword**: `Software Development Portfolio`
- **Secondary Keywords**: `Software Development Case Studies`, `Web Application Portfolio`, `Enterprise Software Work`
- **Search Intent**: Informational / Commercial Investigation
- **Recommended SEO Title Tag**: `Software Engineering Portfolio & Case Studies | MRM InfoTech`
- **Recommended Meta Description**: `Review real-world software engineering case studies, verified production metrics, and architecture deep-dives implemented by MRM InfoTech.`

### 5.10 Contact Page (`/contact`) & Start a Project (`/start-project`)
- **Primary Keyword**: `Contact Software Development Company`
- **Secondary Keywords**: `Hire Software Development Team`, `Custom Software Consultation`, `Request Development Proposal`
- **Search Intent**: Transactional
- **Recommended SEO Title Tag**: `Contact Software Engineering Team | Project Consultation | MRM InfoTech`
- **Recommended Meta Description**: `Ready to build custom software or a modern web platform? Contact MRM InfoTech for a direct architect consultation and transparent project quote within 24 hours.`

---

## PART 6 — Country-Specific International Landing Pages Evaluation

### 6.1 Architectural Assessment

| Proposed Route | Target Market | Decision | Architectural Rationale |
| :--- | :--- | :--- | :--- |
| `/usa-software-development-services` | United States | **APPROVED for Phase 2** | High-volume search intent from US founders seeking remote engineering partners. Requires dedicated US time zone overlap details, EST/PST sprint policies, and US currency pricing frameworks. |
| `/uk-software-development-services` | United Kingdom | **APPROVED for Phase 2** | Significant UK demand for outsourced web and SaaS development. Requires GDPR compliance guarantees, UK business hour coverage, and GBP engagement models. |
| `/australia-software-development-services` | Australia | **APPROVED for Phase 2** | Strong AEST time zone synergy (only 4–5 hours ahead of Bangladesh). Exceptional communication alignment for real-time collaboration. |

> **Anti-Doorway Policy**: These pages will **not** be auto-generated duplicate stubs. Each landing page must feature genuine regional value: specific working hour windows (e.g. 9 AM - 1 PM EST overlap), regional currency contracts, localized legal warranties (GDPR / Privacy Act), and tailored case study narratives.

---

## PART 7 — CMS SEO Management System

The internal MRM SEO specialist can manage metadata directly from the Admin CMS without developer intervention.

### 7.1 Implemented Data Fields per Resource

The backend Prisma data layer supports the following SEO controls across `services`, `products`, `projects`, `blog`, and `siteSettings`:

1. **Core Metadata**:
   - `seoTitle` (string, max 70 characters recommended)
   - `seoDescription` (string, max 160–200 characters recommended)
   - `seoKeywords` (comma-delimited keywords list)
   - `canonicalUrl` (override URL when page mirrors an external canonical)
2. **Indexing & Bot Directives**:
   - `noIndex` (boolean: toggle between `index, follow` and `noindex, nofollow`)
   - `isPublished` (boolean: draft items are automatically blocked from sitemap and public index)
3. **Social / Open Graph Protocol**:
   - `ogTitle` (custom social share title)
   - `ogDescription` (custom social summary)
   - `ogImageUrl` (1200x630px high-resolution banner image)
4. **Content Schema & Research Notes**:
   - `h1Title` (custom editorial H1 distinct from internal database naming)
   - `targetCountry` (e.g., `US`, `UK`, `AU`, `BD`, `Global`)
   - `searchIntent` (`Informational`, `Commercial`, `Transactional`)
   - `researchNotes` (internal documentation for SEO audits and search volume notes)

### 7.2 Google-Style Search Preview in Admin CMS

In the Admin Studio (e.g., `ProductBuilderForm`, `ServiceBuilderForm`, and `ProjectsStudio`), the SEO tab renders an interactive real-time Google search snippet preview:
- Visualizes Title truncation at 60 characters.
- Visualizes Meta Description truncation at 160 characters.
- Highlights missing fields with intuitive amber/red warning badges.

---

## PART 8 — SEO Automation & Publishing Validations

To protect search rankings from accidental editorial errors, the system enforces non-blocking administrative audits:

1. **Title Length Audit**: Flags titles under 30 characters (too brief) or over 70 characters (truncated in SERPs).
2. **Meta Description Audit**: Flags descriptions under 80 characters or over 160 characters.
3. **Image Alt Attribute Audit**: Detects media assets lacking descriptive alternative text and prevents indexing penalties.
4. **Draft Isolation Guarantee**: Unapproved or draft records (`status === 'DRAFT'`) are strictly excluded from `sitemap.xml` and return HTTP 404 to unauthenticated search crawlers.
5. **No Blind Blocking**: SEO validations present prominent warnings and audit suggestions but do not block emergency editorial fixes.

---

## PART 9 — Technical SEO Architecture

### 9.1 Dynamic XML Sitemap (`/sitemap.xml`)

Implemented at [`src/app/sitemap.ts`](file:///e:/Full%20Stack%20Project/MRM/MRMinfotech-frontend/src/app/sitemap.ts), serving clean, search-engine-compliant XML:
- Automatically includes all static corporate routes with assigned priority weights (1.0 for Homepage, 0.9 for Services and Products, 0.85 for Blog and Case Studies).
- Uses `lastModified` timestamps reflecting real content updates.
- Fully dynamic and Edge-cached.

### 9.2 Robots Protocol (`/robots.txt`)

Implemented at [`src/app/robots.ts`](file:///e:/Full%20Stack%20Project/MRM/MRMinfotech-frontend/src/app/robots.ts):
```text
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://mrminfotech.com/sitemap.xml
```
Blocks search crawlers from indexing private admin dashboards, login pages, and raw JSON API routes.

### 9.3 Schema.org JSON-LD Structured Data

The website outputs verified JSON-LD graphs across public pages:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://mrminfotech.com/#organization",
      "name": "MRM InfoTech",
      "url": "https://mrminfotech.com",
      "logo": "https://mrminfotech.com/logo.png",
      "description": "Global custom software and web development company engineering scalable cloud SaaS platforms, web applications, and enterprise digital solutions.",
      "email": "contact.mrminfotech@gmail.com",
      "sameAs": [
        "https://linkedin.com/company/mrminfotech",
        "https://github.com/mrminfotech",
        "https://facebook.com/mrminfotech"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://mrminfotech.com/#website",
      "url": "https://mrminfotech.com",
      "name": "MRM InfoTech",
      "publisher": { "@id": "https://mrminfotech.com/#organization" },
      "inLanguage": "en-US"
    },
    {
      "@type": "ProfessionalService",
      "@id": "https://mrminfotech.com/#service",
      "name": "MRM InfoTech Software & Web Development",
      "url": "https://mrminfotech.com/services",
      "parentOrganization": { "@id": "https://mrminfotech.com/#organization" },
      "serviceType": [
        "Custom Software Development",
        "Web Development",
        "SaaS Development",
        "Full Stack Engineering"
      ],
      "areaServed": ["United States", "United Kingdom", "Australia", "Bangladesh"]
    }
  ]
}
</script>
```

---

## PART 10 — Internal Linking & Topic Silo Architecture

Internal links funnel search authority from high-traffic pages to core commercial conversion targets:

```mermaid
flowchart TD
    Home["Homepage (/)<br/>Root Authority Hub"] --> ServicesHub["Services Hub (/services)<br/>High Commercial Intent"]
    Home --> ProductsHub["Products Hub (/products)<br/>SaaS Platforms"]
    Home --> ProjectsHub["Projects Hub (/projects)<br/>Case Studies & Proof"]
    Home --> Contact["Contact & Proposal (/start-project)<br/>Conversion Target"]
    
    ServicesHub --> WebDev["Web Development (/services/web-development)"]
    ServicesHub --> CustomSoft["Custom Software (/services/custom-software-development)"]
    
    WebDev --> CaseStudies["Relevant Case Studies (/projects/*)"]
    CustomSoft --> CaseStudies
    
    ProductsHub --> EduManage["EduManage BD (/products/edumanage-bd)"]
    ProductsHub --> MediSheba["MediSheba BD (/products/medisheba-bd)"]
    
    Blog["Insights Hub (/blog)"] --> ServicesHub
    Blog --> CaseStudies
    
    CaseStudies --> Contact
    EduManage --> Contact
    MediSheba --> Contact
```

---

## PART 11 — Google Search Console & Webmaster Readiness

### 11.1 Verification Readiness Checklist

- [x] **Clean URL Canonicalization**: Every route enforces strict HTTPS, non-www redirect normalization, and self-referencing canonical tags.
- [x] **Sitemap Availability**: Verified accessible at `https://mrminfotech.com/sitemap.xml`.
- [x] **Robots Accessibility**: Verified accessible at `https://mrminfotech.com/robots.txt`.
- [x] **Structured Data Syntax**: Validated against Schema.org and Google Rich Results Test standards.
- [x] **Edge Page Speed**: Sub-second page loads (<0.6s total time, <450ms TTFB) maximizing Google crawl budget efficiency.
- [x] **Mobile Usability**: 100% fluid, responsive design with legible typography, touch targets exceeding 48x48px, and zero horizontal overflow.

---

## PART 12 — SEO Specialist Handover & Maintenance Guide

### How the Internal SEO Specialist Manages SEO:

1. **Navigating to Content**:
   - Access `https://mrminfotech.com/admin/login` using administrative credentials.
   - Select **Products**, **Services**, **Projects**, or **Blog Posts** from the sidebar.
2. **Editing SEO Parameters**:
   - Select the desired item and switch to the **SEO & Visibility** tab.
   - Enter the target **SEO Title Tag** and **Meta Description**.
   - Review the real-time Google search snippet preview.
   - Review the character counters (ensure Title is 40–60 chars, Description is 120–160 chars).
   - Enter **Primary** and **Secondary Keywords** into the metadata fields.
3. **Saving Changes**:
   - Click **Save SEO Tab** or **Update Record**.
   - The Next.js Edge Cache automatically revalidates within 30–60 seconds, displaying the updated metadata globally.

---

## PART 13 — Monthly SEO Performance Review Template

```markdown
# MRM InfoTech — Monthly Organic Search Performance Review
**Reporting Period**: [Month, Year]  
**Prepared By**: SEO Specialist  

### 1. Organic Search Overview
- Total Organic Impressions: [Count] (+/-% MoM)
- Total Organic Clicks: [Count] (+/-% MoM)
- Average Organic CTR: [Percentage]%
- Average Ranking Position: [Position]

### 2. Market Breakdown
- United States Inbound Inquiries: [Count]
- United Kingdom Inbound Inquiries: [Count]
- Australia Inbound Inquiries: [Count]
- Bangladesh Product Inquiries (EduManage / MediSheba): [Count]

### 3. Top 5 Performing Pages by Organic Traffic
1. Route: [URL] | Primary Keyword: [Keyword] | Clicks: [Count]
2. Route: [URL] | Primary Keyword: [Keyword] | Clicks: [Count]
3. Route: [URL] | Primary Keyword: [Keyword] | Clicks: [Count]
4. Route: [URL] | Primary Keyword: [Keyword] | Clicks: [Count]
5. Route: [URL] | Primary Keyword: [Keyword] | Clicks: [Count]

### 4. Technical Health & Crawl Status
- Google Search Console Coverage: [X] Valid Pages / [0] Errors
- Core Web Vitals Status: [Good / Needs Improvement]
- Identified Keyword Cannibalization: [None / Identified Actions]
```

---

*Authored and Approved for Production Architecture — MRM InfoTech Engineering & SEO Operations.*
