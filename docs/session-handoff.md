# MRM Infotech backend — session handoff

## Stack and status
- Node.js 24.11.0 in this workspace; package requires Node 20+.
- NestJS 11.2.7, Prisma CLI/client 6.19.3, PostgreSQL, TypeScript 5.9.3.
- ESLint 10.12.0, Jest 30.5.2, Prettier 3.9.9; exact dependency tree is locked in `package-lock.json`.
- This is a modular-monolith foundation. No business API or real authentication is implemented.

## Folders and Prisma
- Shared infrastructure: `src/config/`, `src/database/`, `src/common/`, `src/health/`.
- Future features go in `src/modules/<feature>/`; do not generate placeholder module code.
- `.gitkeep` retains empty planned folders.
- Prisma 6 multi-file schema is configured in `prisma.config.ts` to read `prisma/schema/`.
- `schema.prisma` contains generator/datasource; `enums.prisma` contains shared enums.
- Each model belongs in exactly one kebab-case `.prisma` file, e.g. `CaseStudyTranslation` → `case-study-translation.prisma`.
- Import the single database provider: `import { PrismaService } from '../database/prisma.service';`
  and inject it in services. Never instantiate another `PrismaClient`.
- Current schema integrity: 63 models, 14 enums, 100 `@relation`, 13 `@@unique`, 37 `@@index`.

## HTTP and security contracts
- Base route is `/api/v1`; global validation rejects unknown fields and transforms DTO input.
- Error body: `statusCode`, `error`, `message`, `requestId`, `path`, `timestamp`. Prisma errors are translated centrally;
  internal SQL, stack traces and driver details are never returned.
- Use `@Public()` only for intentional anonymous endpoints and `@Permissions('scope:action')` for protected endpoints.
- `PermissionsGuard` allows explicit public routes and denies every other route. Its permission evaluation is
  **NOT IMPLEMENTED**; do not expose admin endpoints until session authentication and RBAC are complete.
- Request IDs use `X-Request-Id`; authorization, cookies, passwords and token fields are redacted from logs.
- Trust proxy is configured by `TRUST_PROXY`; CORS is an exact-origin allow-list. Cookie credentials and CSRF are planned.
- Store timestamps in UTC. `TZ` and `APP_TIMEZONE` default to `Asia/Dhaka` for process/display/scheduling behavior.
- `AuditLog.id` is `BigInt`; map it to a decimal string in response DTOs before JSON serialization.

## Planned authentication (not implemented)
- Use httpOnly/Secure/SameSite cookie sessions with random tokens stored only as hashes.
- Hash passwords with Argon2id; require TOTP 2FA for privileged users; enforce roles → permission keys.
- Record sensitive operations in `AuditLog`; use a one-time, empty-user-table-only bootstrap for the first owner.
- Never seed a default administrator, password, company facts, testimonials, clients or statistics.

## Implement one module — checklist
1. Read the real Prisma model(s), SRS context, architecture guide and implementation status.
2. Create module, controller, service, validated DTOs, explicit response DTOs and Swagger metadata.
3. Public routes are read-only/published-only; admin routes require implemented auth and `@Permissions`.
4. Keep Prisma queries in services; whitelist sort/filter fields; never return raw Prisma rows.
5. Add unit tests with a mocked `PrismaService` and e2e tests for success, validation, not-found and authorization.
6. Do not change schema without an approved proposal; review every generated migration before application.
7. Update implementation status and run `npm run typecheck`, `npm run lint`, `npm run format:check`,
   `npm run test`, `npm run test:e2e`, `npm run prisma:validate`, `npm run prisma:generate`, and `npm run build`.
