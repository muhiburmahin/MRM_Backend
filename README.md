<<<<<<< HEAD
# MRM Infotech — Backend

NestJS **modular monolith** for the MRM Infotech corporate website: an admin-controlled content system
(products, services, pages, brand/theme, team, projects, blog, leads, media, navigation, SEO) on **PostgreSQL + Prisma**.
This is **not** a SaaS application. The public website and the admin UI are separate projects.

> **Status: not production-ready.** The application registers authentication, core admin, health, and implemented
> resource APIs, including page management. Theme/branding, navigation, binary media storage, and other CMS areas remain
> incomplete; no database migration has been created or applied. See
> [implementation status](docs/implementation-status.md) for verified capabilities and limitations.

## Prerequisites

- Node.js 20+ (developed on 22) and npm
- PostgreSQL 14+ — either installed locally or via the optional `docker-compose.yml` (needs Docker)

## Setup

```bash
npm ci
cp .env.example .env            # replace placeholders. Never commit .env
docker compose up -d db         # OPTIONAL local PostgreSQL (skip if you already have one)
npm run prisma:validate         # validate the multi-file schema
npm run prisma:generate         # generate the Prisma client (required after install and after schema changes)
npm run prisma:migrate:dev -- --name init   # LOCAL empty database only. See docs/database-schema.md first
npm run prisma:seed             # system records only; no admin user or demo business data
npm run start:dev               # http://localhost:4000/api/v1/health
```

Swagger UI: http://localhost:4000/docs (on by default in development, off in production unless `SWAGGER_ENABLED=true`).
The seed command requires the schema migration to have been applied first. It creates `en`/`bn`, system permissions and roles,
and the `header`, `footer-company`, and `footer-legal` navigation keys. It does not create an owner account.

## Commands

| Command | Purpose |
|---|---|
| `npm run start:dev` | Development server with reload |
| `npm run build` / `npm run start:prod` | Production build / run `dist/main.js` |
| `npm run typecheck` | TypeScript check (strict) |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `npm run format:check` | Prettier |
| `npm test` / `test:cov` | Unit tests |
| `npm run test:e2e` | End-to-end tests (database mocked; no PostgreSQL needed) |
| `npm run prisma:*` | validate, format, generate, seed, migrate:dev, migrate:deploy, migrate:status |

## Environment

All variables are validated at startup (`src/config/env.validation.ts`); the app refuses to start with a clear message
(values are never printed) if something required is missing or invalid. See `.env.example` for every variable and its meaning.

Replace the angle-bracket placeholders in `DATABASE_URL` before using Prisma or starting the app. The optional Docker Compose
credentials are local-development-only and must never be reused in production.

Key variables: `DATABASE_URL` (required), `CORS_ORIGINS` (exact allow-list, empty = no cross-origin), `TRUST_PROXY` (number of proxies in front),
`LOG_LEVEL`, `SWAGGER_ENABLED`, `THROTTLE_*`, `TZ=Asia/Dhaka`, and `APP_TIMEZONE=Asia/Dhaka`. Database timestamps use UTC;
Dhaka time is for display and scheduling.

## Production

```bash
npm ci
npm run prisma:generate
npm run build
npm run prisma:migrate:deploy   # applies reviewed migrations only; never reset, never db push
NODE_ENV=production npm run start:prod
```

Use `/api/v1/health` for liveness and `/api/v1/health/ready` (checks the database) for load-balancer readiness.
Terminate HTTPS at your reverse proxy / platform and set `TRUST_PROXY` to the number of proxies in front.

## Project layout

See [docs/architecture.md](docs/architecture.md). Short version: `src/config`, `src/database`, `src/common`,
`src/health`, and feature modules under `src/modules/<name>`.
Prisma schema: one model per file in `prisma/schema/` ([docs/database-schema.md](docs/database-schema.md)).

## Documentation

- [docs/architecture.md](docs/architecture.md)
- [docs/database-schema.md](docs/database-schema.md)
- [docs/api-development-guide.md](docs/api-development-guide.md)
- [docs/implementation-status.md](docs/implementation-status.md)
- [docs/session-handoff.md](docs/session-handoff.md)

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Invalid environment configuration -> DATABASE_URL ...` | `.env` missing or incomplete. Copy `.env.example`. |
| `Cannot find module '.prisma/client'` / `@prisma/client did not initialize yet` | Run `npm run prisma:generate`. |
| `P1001: Can't reach database server` | PostgreSQL not running, wrong host/port, or wrong credentials in `DATABASE_URL`. `docker compose up -d db`. |
| `Environment variable not found: DATABASE_URL` from a `prisma` command | Create `.env` (Prisma reads it through `prisma.config.ts`), or export the variable. For `prisma validate` any value works. |
| App starts then exits on boot | The database must be reachable at startup (fail-fast by design). |
| Port already in use | Change `PORT`. |
| Browser blocked by CORS | Add the exact origin (scheme + host + port, no trailing slash) to `CORS_ORIGINS`. |
| Rate limit (429) while testing | Raise `THROTTLE_LIMIT` locally. |
| `prisma generate` fails to download engines (restricted network) | Allow `binaries.prisma.sh`, or set `PRISMA_ENGINES_MIRROR` to an internal mirror. |

## First owner account

The system seed intentionally creates no user and no known-password administrator. Authentication is implemented, and
`AuthProvisioningService` provides one-time first-owner provisioning for an explicitly trusted operator call; there is no
operator CLI or HTTP provisioning route. Provisioning refuses to proceed once any active user exists and stores an
Argon2id password hash. Do not insert a plaintext password or enable a permanent default account.
=======
# MRM_Backend
>>>>>>> 02993decb4e1fafe06e36e50aff68cb12a6ad748
