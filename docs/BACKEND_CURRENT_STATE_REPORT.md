# Backend Current-State Report

## Executive summary

The repository contains a functioning NestJS modular monolith, not just the health-check foundation described in older
project documentation. `AppModule` wires authentication, core admin, and 11 resource modules. Admin routes use
server-side session authentication and permission checks; there are separate public read routes for several content
domains.

The result is a substantial but incomplete backend foundation. Typecheck, build, Prisma validation, lint, unit tests,
and the configured root E2E tests have passed in the latest recorded project verification. This does **not** establish
production readiness: formatting still fails across 51 TypeScript files, four nested resource E2E suites fail to
compile, no live database/API smoke test or migration has been performed, production dependency advisories were
reported in the prior audit, and several security/business requirements are explicitly unsupported or unconfirmed.

This report inventories implemented routes without treating every route as independently tested or every Prisma model
as an approved product requirement. No feature implementation or broad code change was made for this audit.

## Architecture and runtime

- **Stack:** NestJS 11, strict TypeScript, Prisma 6.19.3, PostgreSQL, CommonJS.
- **Application shape:** modular monolith. Global setup provides `/api/v1`, URI versioning, Helmet, exact-origin
  credentialed CORS, request IDs, Pino logging with sensitive-field redaction, validation, exception mapping, and
  throttling.
- **Registered modules:** configuration, database, auth, admin, health, Blog, Company, Contact, FAQs, Media, Products,
  Projects, Services, Site Settings, Team, and Testimonials.
- **Data model:** 63 Prisma models, 14 enums, 100 relation annotations, 13 compound unique declarations, and 37
  indexes in the current schema.
- **Persistence status:** `prisma/sql/constraints.sql` contains additional trust/business constraints, but there are no
  migration files and those SQL constraints have not been applied. No live database/API smoke test was run.
- **Runtime behavior:** Prisma connects during application startup, so a reachable PostgreSQL database is required for
  live startup. Mocked tests do not verify database connectivity, migrations, SQL constraints, or production data.
- **Deployment limits:** rate limiting is in-memory and therefore per process; shared/distributed rate limiting is not
  established by this repository state.

## Route inventory

The list below is derived from the currently registered controllers. It describes route families and implementation
presence, not a claim that every HTTP branch has been exercised end-to-end.

### Platform and authentication

| Surface | Routes | Access |
| --- | --- | --- |
| Health | `GET /api/v1/health`, `GET /api/v1/health/ready` | Public liveness and readiness |
| Authentication | `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `POST /api/v1/auth/change-password` | Login is public and throttled; remaining routes require an authenticated session |
| Admin profile/dashboard | `GET /api/v1/admin/me`, `GET /api/v1/admin/dashboard` | Session; `me` requires any authenticated user, dashboard requires `content:read`, `lead:read`, and `user:read` |

Authentication uses an opaque HttpOnly cookie backed by a server-side session; the database stores a token hash rather
than the raw token. Passwords use Argon2id. The Origin guard protects state-changing cookie-authenticated requests;
browser origins must be configured in both `CORS_ORIGINS` and `AUTH_ALLOWED_ORIGINS`. Login lockout and endpoint
throttling are present. Users with 2FA enabled are denied login because a complete TOTP flow is not implemented.

### Core admin routes

All routes below are under `/api/v1/admin`.

| Routes | Main permissions | State |
| --- | --- | --- |
| `GET /users`, `GET /users/:id` | `user:read` | Paginated/filterable listing and safe user details |
| `POST /users/invites`, `GET /users/invites`, `DELETE /users/invites/:id` | `user:invite` or `user:read` | Invitation creation/list/revocation; plaintext token is returned once for delivery and only its hash is stored |
| `POST /users/invites/accept` | Public, throttled | One-time invitation acceptance |
| `PATCH /users/:id`, `PATCH /users/:id/status`, `POST /users/:id/revoke-sessions` | `user:write` | Profile/status/session management |
| `PATCH /users/:id/role` | `user:write` and `role:write` | Role change with self-escalation protections |
| `DELETE /users/:id` | `user:delete` | Soft deletion and session revocation |
| `GET /roles`, `GET /permissions` | `user:read` | Role/grant and permission listings |
| `POST /roles`, `PATCH /roles/:id`, `DELETE /roles/:id` | `role:write` | Role/grant management |
| `GET /audit-logs` | `audit:read` | Paginated, filterable audit history |

Owner-role protections include preventing deletion, deactivation, or demotion of the last active owner and restricting
permission grants outside the actor's own grants to owners. Role deletion is blocked for system roles and roles with
assigned users or invitations. These invariants have unit-level coverage in the project, but concurrency safety is
not established (see Security and integrity observations).

### Resource APIs

| Resource | Public routes | Admin routes | Authorization / notes |
| --- | --- | --- | --- |
| Blog | `GET /blog`, `GET /blog/:slug` | CRUD at `/admin/blog` | `post:read`, `post:write`, `post:delete` |
| Company | `GET /company` | `GET/PATCH /admin/company` | `settings:write` |
| Contact/leads | Public `POST /contact` | `GET /admin/leads`, `GET /admin/leads/:id`, `PATCH /admin/leads/:id`, `DELETE /admin/leads/:id` | Lead read/write/delete permissions; assignment is global admin capability, not record-owner scoped |
| FAQs | `GET /faqs`, `GET /faqs/:id` | CRUD at `/admin/faqs` | Uses `content:read`, `content:write`, `content:delete` |
| Media | None | `POST /admin/media`, `GET /admin/media`, `GET /admin/media/:id`, `DELETE /admin/media/:id` | Uses `media:upload` for create/read and `media:delete` for deletion; metadata only, no binary upload/storage |
| Products | `GET /products`, `GET /products/:slug` | CRUD at `/admin/products` | `product:read`, `product:write`, `product:delete` |
| Projects | `GET /projects`, `GET /projects/:slug` | CRUD at `/admin/projects` | Project permission constants; trust/publication rules apply |
| Services | `GET /services`, `GET /services/:slug` | CRUD at `/admin/services` | Service permission constants |
| Site Settings | `GET /site-settings` | CRUD at `/admin/site-settings` | `settings:write` |
| Team | `GET /team`, `GET /team/:slug` | CRUD at `/admin/team` | Team permission constants |
| Testimonials | `GET /testimonials`, `GET /testimonials/:id` | CRUD at `/admin/testimonials` | `content:read`, `content:write`, `content:delete`; public trust filtering applies |

The CRUD label reflects controller methods, not necessarily identical lifecycle semantics across resources. Review each
DTO/service and its tests before treating a resource as feature-complete.

### Known unimplemented or unconfirmed domains

There are no registered admin APIs in the current inventory for pages/reusable blocks, themes, navigation, careers/job
postings, subscribers, offices, redirects, announcements, form definitions, pricing plans, industries, technologies,
clients, or trust badges. Some corresponding Prisma models exist. Whether each needs CRUD, what workflows it needs, and
which permissions should guard it are product decisions not established by the code or the reviewed documentation.
Do not infer an implementation requirement from a schema model alone.

## Security and integrity observations

### Implemented controls evidenced in source

- Global session authentication and permission guards are registered by `AuthModule`; an Origin/Referer guard checks
  state-changing cookie-authenticated requests.
- Public routes are explicitly marked; protected route handlers declare permissions or an authenticated-user
  requirement. Validation is global and rejects unknown properties.
- Session tokens, password fields, and related credential fields are redacted from request logs.
- User response shaping avoids credential data; invitation tokens are hashed at rest and returned only at creation.
- Media deletion checks references, and the uploader identity is taken from the authenticated session.
- The root Contact/Media E2E tests exercise current routes using the real global auth/permission guards with mocked
  persistence; their test outcomes are listed below.

### Limitations and potential risks

1. **2FA is unsupported.** Login denies users with 2FA enabled. Enrollment, TOTP verification, recovery codes, and
   password-reset flows are not implemented. Invitation email delivery is also absent.
2. **No first-owner operator CLI.** An explicit provisioning service exists, but there is no operator CLI workflow;
   deployment must provide a trusted, reviewed provisioning process.
3. **Possible owner-count race.** Last-owner checks and first-owner provisioning appear to rely on count-then-write
   operations. No serialization or database uniqueness invariant for the last active owner was established in this
   audit. Concurrent owner mutations/provisioning should be tested and protected before relying on the invariant as a
   concurrency guarantee. This is a potential risk, not a confirmed exploit.
4. **Possible media reference race.** Media reference checks occur separately from deletion. Some media identifier
   columns are plain UUID fields rather than foreign keys, and concurrent reference creation/deletion integrity is not
   established. This is a potential integrity risk, not a confirmed exploit.
5. **Global lead access.** Lead permissions are global; no per-record or tenant ownership policy is implemented. The
   schema is not a demonstrated multi-tenant design. Lead assignment is constrained by its user foreign key.
6. **Audit/revision coverage varies.** User/role operations and selected resource writes are audited; Blog, Products,
   FAQs, and Testimonials do not currently write audit records. Content APIs do not write `Revision` history.
7. **Database invariants are unapplied.** Trust rules, pricing-parent rules, lead contactability, and single-active-theme /
   default-language constraints in `prisma/sql/constraints.sql` are not protected by an applied migration in this
   repository state.
8. **Legacy guard/test confusion.** `src/common/guards/permissions.guard.ts` is a separate fail-closed placeholder and
   is not the active permission guard. The active guard is `src/auth/guards/permissions.guard.ts`, registered through
   `AuthModule`. Tests of the legacy implementation should not be counted as proof of active guard behavior.
9. **Dependency advisories.** The latest recorded successful `npm audit --omit=dev` result reported five production-tree
   advisories: three high in Prisma / `@prisma/config` dependency paths involving `deepmerge-ts`, and two moderate in
   `@nestjs/swagger` dependency paths involving `js-yaml`. Suggested remediation was breaking-version changes; no
   dependency changes were made. A fresh audit attempt during this report could not run because npm reported that an
   existing lockfile was required and unavailable to the audit command. Reconfirm advisories from a reviewed,
   reproducible lockfile before making upgrade decisions.

No destructive security testing or live database integrity testing was performed. No production-readiness claim is
made.

## Verification results and limitations

The following results are from the latest recorded project verification. They are not a substitute for a deployment
smoke test.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm run lint` | Pass; no findings |
| `npm run prisma:validate` | Pass |
| `npm test -- --runInBand` | Pass: 20 suites, 157 tests |
| `npm run test:e2e -- --runInBand` | Pass: 3 configured suites, 35 tests (health 8; contact/leads and media metadata 27) |
| `npm run format:check` | Fail: 51 TypeScript files need formatting; no repository-wide formatting was applied |
| Explicit nested resource E2E run | Company and Site Settings passed (5 tests total); Blog, FAQs, Products, and Testimonials failed to compile because referenced module-local helpers are missing. FAQs and Testimonials also have strict-null TypeScript errors. |
| `npm audit --omit=dev` during this report | Could not execute: npm reports an existing lockfile is required. Prior recorded audit result is summarized above and needs reproducible confirmation. |
| Live PostgreSQL/API smoke test | Not run; no confirmed disposable database |
| Migration application / `constraints.sql` | Not run; no migrations exist and no confirmed disposable database |

The configured E2E runner uses `rootDir: "."` and includes E2E specs matching `.e2e-spec.ts` under `test/`. Resource
specs under `src/modules/**/test` are not covered by that configured run. Therefore, passing root E2E results do not
verify CRUD behavior across all resource modules.

## Documentation and maintenance debt

- `README.md` and `docs/architecture.md` retain older statements that only Health is registered, authentication is not
  implemented, and feature folders are future placeholders. Those statements conflict with `AppModule` and current
  auth/resource controllers.
- The README links to `docs/backend-audit-report.md`, which is a different name from this report; verify and correct
  that link as a separate documentation cleanup.
- `docs/implementation-status.md` and `docs/api-development-guide.md` contain newer and more accurate inventories, but
  still require review for consistent route, audit, migration, and test claims.
- The global formatting check has 51 files needing formatting. Do not mass-format unrelated files as part of feature
   work without an agreed cleanup scope.
- Nested resource E2E test helpers are missing for four suites, and their nullability issues should be addressed
  without weakening assertions or substituting placeholder behavior.
- The workspace has no Git metadata, so this audit could not independently establish a Git diff or identify changes
  made outside the inspected work.

## Readiness assessment and prioritized roadmap

**Assessment: suitable for continued development and mocked verification; not verified for production deployment.**
Core architecture and a meaningful Admin API surface exist, but database deployment/integrity, several resource E2E
tests, 2FA and provisioning operations, dependency advisories, and product scope for unwired domains remain unresolved.

1. **Immediate next step — establish a safe database deployment baseline.** Provision an explicitly disposable PostgreSQL
   database, create and review the initial migration including the intended constraints, then verify migration status,
   seed behavior, and a live health/auth/API smoke test. Do not use production or shared data for this work.
2. Repair the four nested E2E suites by supplying shared test helpers and fixing strict-null errors without weakening
   authentication, authorization, validation, or assertions; include them in the intended test command.
3. Reconfirm dependency advisories from a reproducible lockfile and plan compatible upgrades rather than applying
   force/breaking upgrades automatically.
4. Resolve requirements for schema-backed domains before implementing endpoints; define workflows, validation, and
   permission scopes explicitly.
5. Decide whether audit/revision coverage must be uniform; if so, implement and test it across content mutations.
6. Design and test concurrency-safe owner safeguards and media-reference integrity where these invariants are required.
7. Plan complete 2FA and trusted first-owner provisioning before enabling those operational/security workflows.
