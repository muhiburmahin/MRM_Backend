# Database schema

Source of truth: the Prisma schema supplied for this project ("schema v2"): **63 models, 14 enums**, PostgreSQL.
It was split into one file per model without changing any model, field, relation, index or default.
Prisma version verified: **6.19.3** (multi-file schemas are supported natively; no preview flag).

## Integrity proof

The supplied single-file schema and the current multi-file schema contain the same model and enum names. The declaration
counts before and after the split are identical; this foundation task makes no Prisma schema edits:

| Declaration | Before | After |
|---|---:|---:|
| Models | 63 | 63 |
| Enums | 14 | 14 |
| `@relation` attributes | 100 | 100 |
| `@@unique` declarations | 13 | 13 |
| `@@index` declarations | 37 | 37 |

`schema.prisma` is retained as the non-model file containing only the generator and datasource; it was not renamed to
`base.prisma`. `enums.prisma` contains the shared enums. Each other `.prisma` file contains exactly one model.

## Layout

```
prisma/
├── schema/
│   ├── schema.prisma      # generator + datasource + the schema conventions header (the only non-model file besides enums)
│   ├── enums.prisma       # all 14 enums (enums are shared, so they are not split)
│   └── <model>.prisma     # exactly one model per file, kebab-case of the model name
├── sql/constraints.sql    # CHECK constraints + partial unique indexes Prisma cannot express (see below)
└── migrations/            # created by `prisma migrate dev` (none generated yet)
prisma.config.ts           # points Prisma at prisma/schema and prisma/migrations
```

Adding a model = add one file. Names follow the model name: `CaseStudyTranslation` -> `case-study-translation.prisma`.

## Model-to-file mapping

### Languages

| Model | File |
|---|---|
| `Language` | `prisma/schema/language.prisma` |

### Authentication & access (schema only, not implemented)

| Model | File |
|---|---|
| `User` | `prisma/schema/user.prisma` |
| `Role` | `prisma/schema/role.prisma` |
| `Permission` | `prisma/schema/permission.prisma` |
| `RolePermission` | `prisma/schema/role-permission.prisma` |
| `UserInvite` | `prisma/schema/user-invite.prisma` |
| `Session` | `prisma/schema/session.prisma` |
| `RecoveryCode` | `prisma/schema/recovery-code.prisma` |
| `PasswordReset` | `prisma/schema/password-reset.prisma` |
| `LoginAttempt` | `prisma/schema/login-attempt.prisma` |
| `AuditLog` | `prisma/schema/audit-log.prisma` |
| `Revision` | `prisma/schema/revision.prisma` |

### Brand & media

| Model | File |
|---|---|
| `Theme` | `prisma/schema/theme.prisma` |
| `FontAsset` | `prisma/schema/font-asset.prisma` |
| `MediaFolder` | `prisma/schema/media-folder.prisma` |
| `MediaAsset` | `prisma/schema/media-asset.prisma` |

### Pages & site structure

| Model | File |
|---|---|
| `Page` | `prisma/schema/page.prisma` |
| `PageTranslation` | `prisma/schema/page-translation.prisma` |
| `ReusableBlock` | `prisma/schema/reusable-block.prisma` |
| `NavMenu` | `prisma/schema/nav-menu.prisma` |
| `NavItem` | `prisma/schema/nav-item.prisma` |
| `Announcement` | `prisma/schema/announcement.prisma` |
| `SiteSetting` | `prisma/schema/site-setting.prisma` |
| `Redirect` | `prisma/schema/redirect.prisma` |
| `PolicyVersion` | `prisma/schema/policy-version.prisma` |
| `Office` | `prisma/schema/office.prisma` |

### Products

| Model | File |
|---|---|
| `Product` | `prisma/schema/product.prisma` |
| `ProductTranslation` | `prisma/schema/product-translation.prisma` |
| `ProductFeature` | `prisma/schema/product-feature.prisma` |
| `ProductScreenshot` | `prisma/schema/product-screenshot.prisma` |
| `PricingPlan` | `prisma/schema/pricing-plan.prisma` |
| `ProductIndustry` | `prisma/schema/product-industry.prisma` |

### Services & industries

| Model | File |
|---|---|
| `Service` | `prisma/schema/service.prisma` |
| `ServiceTranslation` | `prisma/schema/service-translation.prisma` |
| `Industry` | `prisma/schema/industry.prisma` |
| `IndustryTranslation` | `prisma/schema/industry-translation.prisma` |
| `Technology` | `prisma/schema/technology.prisma` |
| `ServiceTechnology` | `prisma/schema/service-technology.prisma` |

### Team

| Model | File |
|---|---|
| `TeamMember` | `prisma/schema/team-member.prisma` |
| `TeamMemberTranslation` | `prisma/schema/team-member-translation.prisma` |

### Trust & projects

| Model | File |
|---|---|
| `Client` | `prisma/schema/client.prisma` |
| `Testimonial` | `prisma/schema/testimonial.prisma` |
| `TrustBadge` | `prisma/schema/trust-badge.prisma` |
| `CaseStudy` | `prisma/schema/case-study.prisma` |
| `CaseStudyTranslation` | `prisma/schema/case-study-translation.prisma` |
| `CaseStudyTechnology` | `prisma/schema/case-study-technology.prisma` |
| `CaseStudyMedia` | `prisma/schema/case-study-media.prisma` |

### Blog

| Model | File |
|---|---|
| `PostCategory` | `prisma/schema/post-category.prisma` |
| `Tag` | `prisma/schema/tag.prisma` |
| `Post` | `prisma/schema/post.prisma` |
| `PostTranslation` | `prisma/schema/post-translation.prisma` |
| `PostTag` | `prisma/schema/post-tag.prisma` |

### FAQs & careers

| Model | File |
|---|---|
| `Faq` | `prisma/schema/faq.prisma` |
| `JobPosting` | `prisma/schema/job-posting.prisma` |
| `JobPostingTranslation` | `prisma/schema/job-posting-translation.prisma` |

### Forms, leads, email

| Model | File |
|---|---|
| `FormDefinition` | `prisma/schema/form-definition.prisma` |
| `Lead` | `prisma/schema/lead.prisma` |
| `LeadAttachment` | `prisma/schema/lead-attachment.prisma` |
| `LeadNote` | `prisma/schema/lead-note.prisma` |
| `LeadStatusChange` | `prisma/schema/lead-status-change.prisma` |
| `Subscriber` | `prisma/schema/subscriber.prisma` |
| `EmailTemplate` | `prisma/schema/email-template.prisma` |
| `EmailLog` | `prisma/schema/email-log.prisma` |

Enums (ContentStatus, LaunchStage, LeadType, LeadStatus, PolicyKind, EmailStatus, EmploymentType, BillingPeriod, ThemeMode, FontSource, TrustKind, SubscriberStatus, ScanStatus, MediaKind) are in `prisma/schema/enums.prisma`.

## Conventions (from the schema header)

1. Large content entities use a `*Translation` table (slug, SEO and publish state differ per language).
2. Small child items use `i18n Json` shaped `{ "en": {...}, "bn": {...} }`; validate with Zod in the API when the module is built.
3. Languages are data. Every `locale` column is a real FK to `Language.code`.
4. **Trust rule:** `Client`, `Testimonial`, `CaseStudy`, `TrustBadge` are public only when verified with written evidence. API must enforce it; `prisma/sql/constraints.sql` enforces it in the database too.
5. No EduManage BD / MediSheba BD operational data is stored here.
6. Content the owner may change without a developer is data (Theme, logo, fonts, navigation, pages/blocks, products, services, pricing, offices, announcements, email templates, forms, SEO, redirects).

## Media reference convention (intentional, preserved)

- Most media references are plain UUID columns marked `// -> MediaAsset.id` (for example `Product.logoId`, `Product.heroImageId`, `PageTranslation.ogImageId`, `Post.coverId`, `CaseStudy.coverId`, `TeamMember.photoId`, `Client.logoId`, `Technology.iconId`).
  The API must check they point to an existing asset and must refuse to delete an asset that is in use (a "media-in-use guard").
- Real foreign keys exist where the link is structural: `User.avatarId`, all five `Theme` image links, `FontAsset.mediaId`, `ProductScreenshot.mediaId`, `CaseStudyMedia.mediaId`.
- Do not "normalise" this: do not add relations to the plain UUID columns without an approved reason.
- The supplied instruction saying only `User.avatar` and `MediaAsset.uploadedBy` are real media relations conflicts with schema v2:
  `Theme`, `FontAsset`, `ProductScreenshot`, and `CaseStudyMedia` also have explicit foreign-key relations. The existing schema is
  preserved; removing those relations would require a separately reviewed schema change.

## Bangladesh / international notes

| Topic | Decision | Rationale / smallest compatible approach |
|---|---|---|
| Timezone | No schema change | Keep instants in UTC. `TZ` and `APP_TIMEZONE` default to `Asia/Dhaka`; convert Dhaka wall-clock scheduling input to UTC in the future admin DTO/service. Existing `DateTime` columns are not changed to `@db.Timestamptz` without a migration review. |
| Phone | No schema change | `Lead.phone` remains free text. The future DTO should validate and normalize BD mobile numbers and international numbers to E.164. No duplicate normalized column until a real search/deduplication query needs one. |
| BDT pricing | No schema change | `PricingPlan` already has nullable `amount`, ISO-4217 `currency` (currently default `USD`), and `isPublic` (default false/contact-us). Keep mixed currencies possible; confirm the default/public-pricing policy before changing the USD default. |
| Bangla and English | No schema change | `Language` and translation tables already support `en` and `bn`; the seed marks English as default. `(locale, path)` and `(locale, slug)` uniqueness is appropriate. Recommend ASCII-transliterated URL slugs at the application layer; do not constrain stored content text. |
| Bangla text/search | No schema change | Use PostgreSQL UTF-8. Bengali collation/search behavior must be tested against actual queries. Defer `simple` full-text configuration or `pg_trgm` until search is a real requirement. |
| Institution/location | No schema change | Keep institution type, division, district and similar demo-request fields in `Lead.payload`; validate the known form shape in the future DTO. Promote only fields that admin users must filter/report on frequently. |
| International customers | No schema change | Validate `Lead.country` as ISO 3166-1 alpha-2 in the future DTO. `locale` identifies the requested content language and is independent of country. |
| Email case | No schema change | Normalize and trim email to lowercase in the user service before writes; retain the current unique constraint. `citext` would require an extension and migration and is not needed for this foundation. |
| Consent and retention | No schema change | `consentAt`, `policyId`, `retentionUntil` and `anonymizedAt` cover the required lifecycle fields. Confirm retention and consent wording with qualified legal counsel; this document makes no claim about current Bangladesh law. |
| Soft delete | No schema change | `deletedAt` on `User` and `Lead` is intentional for account lifecycle and lead retention. Do not add it to every content model. |
| Indexes | No schema change | Lead indexes cover status/date, type/date, assignee and retention. Translation tables index status/publish time and uniquely index locale plus URL. No composite additions without an actual query plan or measured workload. |

No schema changes or migrations were created for this review.

## System seed

`npm run prisma:seed` upserts only `Language` (`en`, `bn`), permissions, five system roles and the `header`, `footer-company`,
and `footer-legal` menu keys. It creates no users or business/demo content. Role mapping is intentionally least-privilege:
owner gets all keys; admin lacks `user:delete` and `role:write`; editor gets content read/write/publish, media upload and nav write;
sales gets content read plus lead read/write and subscriber read; viewer gets content-read keys only.
The seed never deletes grants. If a system role already has a grant outside the current policy, seeding fails and reports the keys
for explicit review rather than silently retaining broader access. When authorization is implemented, `user:write` must not
permit changing `User.roleId`; role assignment must require the owner/role-management policy.

## Migration safety rules

1. Never run `prisma migrate reset`, `prisma db push --force-reset` or `prisma migrate dev` against a database that holds real data.
2. Production only ever receives `prisma migrate deploy`, run by a person, after the SQL in the migration folder was read.
3. Every migration is reviewed. Anything that drops/renames a column or table, changes a type, or adds a NOT NULL column without a default needs explicit approval and a backup first.
4. Create risky migrations with `--create-only`, read the SQL, then apply.
5. Do not edit a migration that was already applied anywhere.
6. Keep `prisma/migrations` in Git.

## Commands

```bash
npm run prisma:validate        # validate the multi-file schema (needs DATABASE_URL set to any value)
npm run prisma:format          # format all schema files
npm run prisma:generate        # generate the Prisma client
npm run prisma:seed            # seed system records only; requires an applied schema
npm run prisma:migrate:dev -- --name init    # LOCAL empty dev database only: creates + applies the first migration
npm run prisma:migrate:dev -- --create-only --name reviewed_change  # create SQL; inspect it before any apply
npm run prisma:migrate:deploy  # apply existing migrations (staging/production)
npm run prisma:migrate:status
```

`prisma migrate dev --create-only` still connects to a development database to calculate the migration. Never point it at
production. Review the generated SQL and obtain explicit approval before applying a migration.

### First-time database setup (local)

```bash
docker compose up -d db                                   # optional local PostgreSQL
cp .env.example .env
npm run prisma:migrate:dev -- --name init                 # creates prisma/migrations/<timestamp>_init
npx prisma migrate dev --create-only --name constraints   # then paste prisma/sql/constraints.sql into the new migration.sql
npm run prisma:migrate:dev                                # applies it
```

`prisma/sql/constraints.sql` adds: trust-rule CHECKs on `Client`/`Testimonial`/`TrustBadge`/`CaseStudy`, "exactly one parent" CHECK on `PricingPlan`,
"a lead needs email or phone" CHECK, and partial unique indexes (one active `Theme`, one default `Language`).
It was **not applied or executed** during foundation work (no database was available); apply it as a reviewed migration.

## Known schema review points (not changed, for your decision later)

- `AuditLog.id` is `BigInt`; JSON serialisation needs care when the audit module is built.
- Convert `BigInt` identifiers to decimal strings in response DTOs before JSON serialization; native `JSON.stringify` throws on `BigInt`.
- `PageTranslation.updatedById`, `SiteSetting.updatedById` are plain UUIDs without relations (kept as supplied).
- Prisma 7 will change generator configuration; revisit `prisma/schema/schema.prisma` and `prisma.config.ts` at upgrade time.
