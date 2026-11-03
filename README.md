# MRM InfoTech — Corporate Website Backend

NestJS 11 **modular monolith** for the MRM InfoTech corporate website and admin dashboard, powered by **PostgreSQL + Prisma ORM** with Argon2id password hashing, HttpOnly session cookies, granular RBAC, and fail-closed application security.

---

## 1. Prerequisites

- **Node.js**: `v20.x` or `v22.x` (`v22.x` recommended)
- **Package Manager**: `npm` (lockfile version 3)
- **Database**: PostgreSQL 16+ (local native service or containerized via Docker)

---

## 2. Quick Start & Developer Setup

### Clone and Install
```bash
git clone <repo-url>
cd MRM_Backend
npm ci
```

### Environment Configuration
Copy `.env.example` to `.env` and fill in local development values:
```bash
cp .env.example .env
```
> [!IMPORTANT]
> Never commit `.env` or place production secrets in `.env.example`.

### Prisma Client Generation
Prisma Client is automatically generated before tests (`pretest`) and before production builds (`build`). To generate it manually at any time without database access:
```bash
npm run prisma:generate
```

---

## 3. Database Workflows

### Command Categories

| Command | Category | Live Database Required? | Safety Level |
|---|---|---|---|
| `npm run typecheck` | Quality | **No** | Safe |
| `npm run lint` | Quality | **No** | Safe |
| `npm run format:check` | Quality | **No** | Safe |
| `npm test` | Testing | **No** (Unit mocks) | Safe |
| `npm run test:e2e` | Testing | **No** (Uses FakePrisma) | Safe |
| `npm run build` | Build | **No** (Compiles TS) | Safe |
| `npm run prisma:generate` | Schema | **No** (Static generation) | Safe |
| `npm run prisma:validate` | Schema | **No** (Validates multi-file schema) | Safe |
| `npm run prisma:migrate:status`| Migration | **Yes** (Reads `_prisma_migrations`) | Safe (Read-only) |
| `npm run prisma:migrate:deploy`| Migration | **Yes** (Applies pending migrations) | Safe for production |
| `npm run prisma:seed` | Data | **Yes** (Populates system roles) | Safe |
| `npm run prisma:migrate:dev` | Migration | **Yes** (Dev database only) | **NEVER RUN ON PRODUCTION** |

> [!CAUTION]
> Commands such as `prisma migrate reset` and `prisma db push` are strictly prohibited on production and staging environments as they cause irreversible data loss.

---

## 4. Key Workflows & Features

### 4.1 Authentication & Two-Factor Authentication (2FA)
- **Password Security**: Argon2id hashing with automatic rehash detection.
- **Session Security**: Server-side sessions with SHA-256 token hashing; delivered via `HttpOnly`, `SameSite=Lax`, `Secure` cookies.
- **Origin Guard**: Enforces origin checks against `AUTH_ALLOWED_ORIGINS` for non-idempotent state mutations.
- **Two-Factor Authentication**:
  - `POST /api/v1/auth/login`: Authenticates credentials. If 2FA is active, returns `{ requiresTwoFactor: true, twoFactorTicket }` without setting a session cookie.
  - `POST /api/v1/auth/2fa/verify`: Verifies pending ticket with a 6-digit TOTP code or single-use recovery code, issuing a session cookie on success.
  - `POST /api/v1/auth/2fa/generate`: Authenticated endpoint to generate new TOTP secret & `otpauth://` URI.
  - `POST /api/v1/auth/2fa/enable`: Authenticated endpoint to verify TOTP code and activate 2FA, returning 8 single-use backup recovery codes.
  - `POST /api/v1/auth/2fa/disable`: Authenticated endpoint to disable 2FA after password confirmation.

### 4.2 Lead Notification & Mail Readiness
- Incoming contact inquiries (`POST /api/v1/contact/inquiries`) and project leads (`POST /api/v1/contact/leads`) are persisted to PostgreSQL.
- Asynchronous notifications are dispatched to company sales and customer confirmations are sent to the client.
- **Fault-Tolerant Delivery**: If email transport is disabled or fails, the lead is safely retained in the database with zero data loss.
- **Configuration** in `.env`:
  ```ini
  MAIL_ENABLED=true
  MAIL_FROM="MRM InfoTech <no-reply@mrminfotech.com>"
  MAIL_NOTIFY_RECIPIENT="leads@mrminfotech.com"
  SMTP_HOST=smtp.sendgrid.net
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USER=apikey
  SMTP_PASSWORD=your_api_key
  ```

---

## 5. Automated CI/CD Pipeline

A GitHub Actions workflow is configured at [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and executes on every push and pull request to `main`:

1. Checkout repository & setup Node.js 22 with npm cache.
2. Clean dependency installation (`npm ci`).
3. Offline Prisma Client generation (`npm run prisma:generate`).
4. Code formatting verification (`npm run format:check`).
5. ESLint static analysis (`npm run lint`).
6. TypeScript strict typechecking (`npm run typecheck`).
7. Full unit test execution (`npm test -- --runInBand`).
8. Integrated E2E test execution (`npm run test:e2e -- --runInBand`).
9. Production build compilation (`npm run build`).

---

## 6. Production Deployment

```bash
# 1. Clean install production dependencies
npm ci

# 2. Generate Prisma Client
npm run prisma:generate

# 3. Compile NestJS distribution
npm run build

# 4. Deploy reviewed migrations to PostgreSQL
npm run prisma:migrate:deploy

# 5. Start application in production mode
NODE_ENV=production npm run start:prod
```

### Health Probes
- **Liveness Probe**: `GET /api/v1/health` (returns `200 OK` if process is responding)
- **Readiness Probe**: `GET /api/v1/health/ready` (verifies live PostgreSQL connectivity)
