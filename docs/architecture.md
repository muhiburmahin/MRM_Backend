# Architecture

## Style

A single deployable NestJS application (**modular monolith**) talking to one PostgreSQL database through Prisma.
No microservices, queues, caches, event bus or object-storage integration exist or are needed at this stage.

## Layout

```
src/
├── main.ts               bootstrap only (logger, configureApp, swagger, shutdown hooks, listen)
├── app.setup.ts          configureApp(): trust proxy, helmet, CORS, /api prefix, URI versioning, global ValidationPipe
├── app.module.ts         wires config, logging, rate limiting, database, health, global exception filter
├── config/               env validation (class-validator) + AppConfigService (the ONLY reader of configuration)
├── database/             PrismaService (single client) + global DatabaseModule
├── common/               decorators, default-deny guards, constants, DTOs, filters, pipes, types, utils
├── health/               /health (liveness) and /health/ready (database)
├── auth/, users/, admin/  reserved for future authentication and administrative modules
└── modules/              one reserved folder per future feature; no placeholder business code
prisma/schema/            one model per file (see database-schema.md)
test/                     e2e tests + env setup
```

Git-tracked empty feature folders contain only `.gitkeep` until implemented. No placeholder business modules are generated.

## Dependency flow

```
main.ts -> app.setup.ts -> AppConfigService
AppModule -> AppConfigModule (global) , DatabaseModule (global) , LoggerModule , ThrottlerModule , HealthModule , [future feature modules]
feature module: Controller -> Service -> PrismaService   (controllers never touch Prisma; services never touch HTTP objects)
```

Rules: feature modules import nothing from each other's internals; shared things go to `common/`; configuration is read only via `AppConfigService`;
the Prisma client is created only in `PrismaService`.

## Application lifecycle

1. Environment validated (`validateEnv`) — invalid/missing => process exits with a clear message, no values printed.
2. Nest builds the DI graph; `PrismaService.onModuleInit` connects to PostgreSQL (fail fast).
3. `configureApp` applies security headers, CORS allow-list, prefix `/api`, URI version `v1`, global validation.
4. Requests: request id (safe inbound `X-Request-Id` or a new UUID) -> rate limit -> default-deny permissions guard
   -> validation -> controller -> service -> Prisma.
5. Any error -> `AllExceptionsFilter` -> one consistent JSON shape (`statusCode`, `error`, `message`, `requestId`, `path`, `timestamp`).
6. `SIGTERM/SIGINT` -> graceful shutdown, database disconnected.

## API conventions

- Base path `/api/v1`. Un-versioned paths are not served.
- **No universal response wrapper.** Successful responses return the resource (or `{ items, meta }` for collections, see `Paginated<T>`).
  Errors use the single error shape above. This keeps normal HTTP semantics, caching and streaming straightforward.
- Status codes: 200 read/update, 201 create, 204 delete with no body, 400 validation, 401/403 auth (future), 404, 409 conflict (unique/relations), 429 rate limit, 503 not ready.
- Collections: `page`, `pageSize` (max 100), `sortOrder` via `PaginationQueryDto`; modules add their own filters.

## Security boundaries (what exists now)

| Item | State |
|---|---|
| Secure headers (Helmet), `X-Powered-By` removed | Implemented |
| CORS exact-origin allow-list from env (no wildcard) | Implemented |
| Global rate limit per IP (`@nestjs/throttler`) | Implemented (per-route limits to be added, e.g. login/forms) |
| Global validation: whitelist, reject unknown properties, transform | Implemented |
| No stack traces / SQL / driver messages in responses (dev or prod) | Implemented + unit/e2e tested |
| Request id on every response; authorization, cookies, passwords and tokens redacted from request logs | Implemented |
| `@Public()` and `@Permissions(...)` contracts; fail-closed session authentication and permission evaluation | Implemented for registered modules |
| Env validation, no secrets in repo | Implemented |
| **Authentication, cookie sessions, RBAC evaluation, login lockout, audit writing** | **Implemented; 2FA is fail-closed and not yet supported** |
| File upload validation / virus scan, signed URLs | **NOT implemented** |
| CSRF protection | **NOT implemented** (needed when cookie sessions are added) |

The `ThrottlerGuard` registered globally is **rate limiting only**. Separate global guards validate server-side cookie
sessions and evaluate `@Permissions(...)`; both fail closed. Every non-public route must declare `@Permissions(...)` or
`@AnyAuthenticated()`. Invitation acceptance is an explicitly public, rate-limited route; all other admin routes require
the session cookie.

## Authentication & authorization

The schema already defines a **server-side session** design: `User` (argon2id `passwordHash`, `twoFactorEnabled`, `twoFactorSecretEnc`, `mustChangePassword`, `isActive`),
`Role` / `Permission` / `RolePermission` (permission keys listed in `permission.prisma`), `Session` (`tokenHash`, `expiresAt`, `revokedAt`), `RecoveryCode`, `PasswordReset`,
`UserInvite`, `LoginAttempt`, `AuditLog`, `Revision`.
Implemented: an HttpOnly + SameSite cookie holds a random token stored only as a hash in `Session`; passwords use Argon2id;
session permissions are loaded from role grants for each request; login lockout and per-route throttling are enabled;
state-changing cookie-authenticated requests require an allow-listed `Origin` or `Referer`; admin user, role, invitation,
dashboard, and audit endpoints use least-privilege permission keys. Sensitive user and role operations are written to
`AuditLog`. CORS credentials are enabled only for configured exact origins (`CORS_ORIGINS`); keep that list aligned with
`AUTH_ALLOWED_ORIGINS`.

Limitations: TOTP/2FA sign-in, email delivery, invitation email delivery, recovery/reset, and a CLI first-owner provisioning
command are not implemented. `AuthProvisioningService` can provision the first owner through an explicit trusted call;
the system seed creates no users. Accounts with 2FA enabled are denied login until a complete TOTP flow is available.

## Planned feature modules and the models they will own

| Module (`src/modules/…`) | Models |
|---|---|
| `auth`, `users` (+ `admin` area) | User, Role, Permission, RolePermission, UserInvite, Session, RecoveryCode, PasswordReset, LoginAttempt, AuditLog, Revision |
| `media` | MediaFolder, MediaAsset, FontAsset |
| `site-settings` | SiteSetting, Theme, Announcement, Redirect, Language, PolicyVersion |
| `navigation` | NavMenu, NavItem |
| `pages` (+ `company`) | Page, PageTranslation, ReusableBlock, Office |
| `products` | Product, ProductTranslation, ProductFeature, ProductScreenshot, PricingPlan, ProductIndustry |
| `services`, `industries` | Service, ServiceTranslation, Industry, IndustryTranslation, Technology, ServiceTechnology |
| `team` | TeamMember, TeamMemberTranslation |
| `projects` (+ trust) | CaseStudy, CaseStudyTranslation, CaseStudyTechnology, CaseStudyMedia, Client, Testimonial, TrustBadge |
| `blog` | Post, PostTranslation, PostCategory, Tag, PostTag |
| `faqs`, `careers` | Faq, JobPosting, JobPostingTranslation |
| `inquiries` | FormDefinition, Lead, LeadAttachment, LeadNote, LeadStatusChange, Subscriber, EmailTemplate, EmailLog |

## Deviations from the SRS (documented decision)

The SRS (sections 7.5 and 8) recommends no database-backed admin and repo-based content at launch. The project owner has since required that
**the entire website is admin-controlled**, so a database-backed content system is built from the start. SRS guidance that still applies:
no custom over-engineering, trust rule (no invented testimonials/clients/statistics), privacy-minimal lead data, security headers, Zod-validated JSON blocks,
and the SRS proposal of a 12-month lead retention default (to be configured when the Leads module is built).

## Extension points (no implementation yet)

Email provider, object storage, search, and analytics are behind future provider interfaces configured by environment variables. None is installed now.
