# Implementation status

_Foundation status, verified 2026-10-10. This file lists only what exists and what was actually run._

## Admin API update (2026-10-12)

- Core admin APIs provide authenticated profile/dashboard, paginated user search, safe user details, user profile/status/
  role management, session revocation, soft deletion, role and permission management, invite create/list/revoke/accept,
  and paginated audit logs.
- Resource admin APIs are wired for Blog, Products, FAQs, Testimonials, Company, Leads, Media metadata, Projects,
  Services, Site Settings, Team, Pages, and Navigation. Admin access uses server-side session cookies and permission
  checks; public and admin reads remain separate.
- Pages support localized content management, parent hierarchy, public path lookup, draft/review/scheduled/published/
  archived statuses, SEO metadata, and system-page deletion protection. Public lookup serves published translations
  after `publishedAt` and scheduled translations once `scheduledAt` is reached; fallback uses the enabled default locale.
- Page blocks are validated with Zod for a known block-type envelope, unique block IDs, and JSON-object data. Per-type
  block payload schemas are not defined in the available requirements, so this implementation does not claim to validate
  individual block data fields or sanitize markup for frontend rendering.
- Navigation administration supports menu listing, item-count summaries, menu retrieval as a nested tree, custom menu
  creation/renaming, and item create/update/reorder/delete. The seeded `header`, `footer-company`, and `footer-legal`
  keys cannot be changed. Item labels, descriptions, and badges require enabled locales; each item has exactly one
  existing page/product/service target or a validated local/HTTP(S) href. Cross-menu parents, cycles, and deleting
  non-leaf items are rejected. A public navigation read API is not included.
- Credentialed CORS is restricted to exact origins configured for both CORS and CSRF origin validation. Invitation
  tokens are stored only as hashes and returned once for delivery. User/role changes and selected resource operations
  write audit records; audit coverage is not uniform.
- Dashboard counts use the current Prisma schema and account for content publication/trust rules. User responses omit
  credentials; audit-log `BigInt` IDs are serialized as strings.
- Media APIs manage provider-neutral metadata and block deletion while referenced; they do not upload file bytes or
  configure storage. Reusable-block CRUD, themes/branding, navigation, job postings, subscribers, offices, redirects,
  announcements, forms, pricing plans, industries, technologies, clients, and trust badges have no admin APIs.
  Provider/storage and several domain behaviors remain unconfirmed product scope.
- 2FA login, invitation email delivery, an operator CLI for first-owner provisioning, and content revision history are
  not implemented. The trusted first-owner provisioning service exists; accounts with 2FA enabled are denied login
  until a complete flow exists.
- Lead/media tests verify permission denial; lead assignment remains a global admin capability constrained by its user
  foreign key, not a record-owner policy. Media uploader identity comes from the authenticated session.

### Verification run 2026-10-12

| Check                                       | Result                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run typecheck`                         | Pass                                                                                |
| `npm run build`                             | Pass                                                                                |
| `npm test -- --runInBand`                   | Pass: 20 suites, 157 tests                                                          |
| `npm run test:e2e -- --runInBand`           | Pass: 3 suites, 35 tests (health 8; contact/leads and media metadata 27)            |
| `npx prisma validate`                       | Pass                                                                                |
| `npm run lint`                              | Pass: no findings                                                                   |
| `npm run format:check`                      | Fails: 51 TypeScript files need formatting; no repository-wide reformat was applied |
| Prettier check for changed TypeScript files | Pass; documentation is not covered by the script                                    |
| Live database/API smoke test                | Not run; no confirmed disposable PostgreSQL database                                |

### Pages implementation verification run 2026-10-12

| Check | Result |
|---|---|
| Pages API/service tests | Pass: 2 suites, 9 tests; Prisma is mocked |
| PostgreSQL integration / migration | Not run; no database was accessed and no migration was created |

### Navigation implementation verification run 2026-10-13

| Check | Result |
|---|---|
| Navigation API/service tests | Pending final verification; tests use mocked Prisma |
| PostgreSQL integration / migration | Not run; no database was accessed and no migration was created |

The foundation checklist and verification table below are historical results from 2026-10-10, not current
production-readiness sign-offs.

## Done

- NestJS 11, strict TypeScript, ESLint 10 (flat config), Prettier, Jest unit and e2e tests.
- Environment validation (`EnvironmentVariables`), central `AppConfigService`, `.env.example` with placeholders only, validated exact CORS origins and IANA timezones. `TZ` / `APP_TIMEZONE` default to `Asia/Dhaka`.
- Prisma 6.19 multi-file schema: 63 models, one model per file; 14 enums in `enums.prisma`; generator/datasource in `schema.prisma`; `prisma.config.ts`.
- Supplied single-file schema compared block-by-block with local schema: model/enum blocks match. Declaration counts match: 63 models, 14 enums, 100 `@relation`, 13 `@@unique`, 37 `@@index`.
- Both supplied reference schema and local multi-file schema validate with Prisma 6.19.3. Client generated from local schema.
- `prisma/sql/constraints.sql` (trust-rule CHECKs, partial unique indexes) is written but **not applied**. No migration created or applied.
- Single `PrismaService` + global `DatabaseModule` (connect on start, disconnect on shutdown).
- `/api/v1` prefix + URI versioning; global whitelist/transform validation; consistent exception response; Prisma errors mapped centrally without exposing SQL.
- Helmet, exact-origin CORS allow-list, global rate limit, trust-proxy setting, request IDs, structured Pino logging. Request header secrets are redacted; error logging avoids raw exception data and query strings.
- `GET /api/v1/health` liveness and `GET /api/v1/health/ready` readiness (database, 2 s timeout, 503 on failure).
- Swagger at `/docs` (development default on; production default off).
- Reusable pagination DTO/helpers.
- `@Public()` / `@Permissions(...)` contracts, fail-closed session-cookie authentication, RBAC permission evaluation, and default-deny guards.
- Idempotent system-only seed: `en`/`bn`, permission keys, five roles and documented grants, and `header`, `footer-company`, `footer-legal` navigation keys. No user or business/demo data.
- Optional `docker-compose.yml` for local PostgreSQL. Reserved empty folders contain `.gitkeep`; no placeholder business modules.
- Documentation: README, architecture, database schema, API development guide, implementation status, and session handoff.

## Intentionally NOT implemented

- 2FA login, an operator CLI for first-owner provisioning, invitation email delivery, binary media upload/storage,
  virus scanning, i18n resolution, Zod JSON-block schemas, and content revision history.
- Admin APIs for reusable blocks, themes, navigation, job postings, subscribers, offices, redirects, announcements,
  forms, pricing plans, industries, technologies, clients, trust badges, and other schema domains not listed above.
  Product requirements for these domains remain unconfirmed. The Pages API exists, but detailed block payload schemas
  still need approved contracts.
- Prisma migrations: none generated or applied.

## Verification (actually executed 2026-10-10, Windows, Node 24.11.0, npm 11.6.1)

| Check                                              | Result                                                                                                                                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                           | Pass; installed 768 packages. npm reported 24 audit issues (21 moderate, 3 high).                                                                                                                               |
| `npm ls --depth=0`                                 | Pass; all declared direct dependencies installed.                                                                                                                                                               |
| `prisma validate` (local multi-file schema)        | Pass: schemas at `prisma\schema` are valid.                                                                                                                                                                     |
| `prisma validate` (supplied single-file reference) | Pass: schema is valid.                                                                                                                                                                                          |
| `prisma generate`                                  | Pass: Prisma Client v6.19.3 generated from local schema.                                                                                                                                                        |
| `npm run typecheck`                                | Pass.                                                                                                                                                                                                           |
| `npm run lint`                                     | Pass, 0 reported errors.                                                                                                                                                                                        |
| `npm run format:check`                             | Pass: all matched TypeScript files use Prettier style.                                                                                                                                                          |
| `npm run test -- --runInBand`                      | Pass: 6 suites, 24 tests (health controller/service, permission guard, environment validation, exception mapping, pagination).                                                                                  |
| `npm run test:e2e -- --runInBand`                  | Pass: 1 suite, 8 tests; Prisma is mocked.                                                                                                                                                                       |
| `npm run build`                                    | Pass.                                                                                                                                                                                                           |
| `npm audit --omit=dev`                             | Reports 5 production-tree advisories: 3 high (`prisma` / `@prisma/config` via `deepmerge-ts`) and 2 moderate (`@nestjs/swagger` via `js-yaml`). No upgrades made because suggested fixes change major versions. |
| Live server + `/api/v1/health`                     | Not run. Docker is installed but the Docker Desktop Linux engine pipe is unavailable, and no safe project database was confirmed. Mocked e2e liveness passes.                                                   |
| Seed, migrations, `constraints.sql`                | Not run; no confirmed disposable project database.                                                                                                                                                              |

## Known limitations and risks

1. The server intentionally connects to PostgreSQL at boot (fail-fast); live startup requires a confirmed local development database.
2. Rate limiting is in-memory per process; this baseline is for one instance.
3. Cookie sessions require both `CORS_ORIGINS` and `AUTH_ALLOWED_ORIGINS` to include the browser origin. Review these values and seeded role grants before production.
4. Resource E2E specs located under `src/modules/**/test` are not discovered by the configured E2E runner; several still reference missing module-local helper files and are unverified. The 35 passing E2E tests are only the three suites under `test/`.
5. Audit coverage varies by content module; revision history is not written.
6. `npm audit --omit=dev` previously reported 5 advisories (3 high, 2 moderate); re-run and review dependency upgrades separately.
7. Revisit generator configuration and Prisma CLI config when upgrading beyond Prisma 6.
8. Schema review decisions and unresolved questions are recorded in `database-schema.md`.

## Recommended next modules (in order)

1. Confirm which currently unwired schema domains actually need management APIs, and define workflows and permission scopes before implementing them.
2. Repair/register the nested resource E2E suites and add coverage for currently unverified resource CRUD modules.
3. Implement invitation email delivery, a secure first-owner provisioning process, and a complete 2FA login flow before enabling 2FA enrollment.
4. Decide whether audit coverage and content revisions are required for every resource write; implement consistently if confirmed.
5. Provide an approved binary media storage provider if uploads are required.
6. Run end-to-end smoke tests against a confirmed disposable PostgreSQL database; review dependency advisories and production role grants.
