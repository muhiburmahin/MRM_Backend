# MRM InfoTech Backend: Production Blockers & Prioritized Roadmap

**Project:** MRM InfoTech Official Corporate Website Backend  
**Date:** October 31, 2026  
**Auditor Roles:** Senior Software Architect, Principal Backend Engineer, Security Engineer, DevOps Engineer  
**Reference Document:** [`MRM_COMPLETE_BACKEND_PRODUCTION_READINESS_AUDIT.md`](file:///d:/MRM/MRM_Backend/MRM_COMPLETE_BACKEND_PRODUCTION_READINESS_AUDIT.md)  

---

## 1. Executive Summary of Blockers

While the backend architecture, security controls, and business logic are robust, three categories of issues must be addressed before entering a true production environment:

1. **Environmental & Verification Blockers (P0):** The absence of Docker / local PostgreSQL on the development machine has prevented live verification of the 1,280-line initial Prisma migration and database seed operations.
2. **Security & Authentication Defects (P0):** Two-factor authentication is enabled in the database schema and flag logic, but its implementation in `AuthService` throws an `UnauthorizedException`, permanently locking out any user with `twoFactorEnabled = true`.
3. **Operational Workflows & Launch Prerequisites (P1):** Lack of transactional email dispatch for contact inquiries/leads, formatting drift across 188 files, missing CI/CD automation, and unlinked nested E2E test suites.

---

## 2. Priority Classification Matrix

- **P0 — Critical Production Blockers:** Must be resolved before any deployment. System is inoperable or fundamentally unsafe without these fixes.
- **P1 — Required Before Initial Production Launch:** Essential operational, reliability, testing, and workflow requirements for public launch.
- **P2 — Important Improvements:** High-value post-launch enhancements for resilience, scaling, and developer velocity.
- **P3 — Future Enhancements:** Non-blocking CMS expansion features and future product integrations.

---

## 3. Prioritized Implementation Task Cards

### 3.1 P0 — Critical Production Blockers

---

#### Task Card: BLK-P0-01 — Live PostgreSQL Environment Provisioning & Migration Application
- **Task ID:** `BLK-P0-01`
- **Priority:** **P0 (Critical Blocker)**
- **Problem:** Migration `prisma/migrations/20261030194410_init/migration.sql` was generated offline and statically reviewed, but has never been applied to an active PostgreSQL database. Docker is missing on the Windows host.
- **Affected Files:**
  - `docker-compose.yml`
  - `prisma/migrations/20261030194410_init/migration.sql`
  - `prisma/sql/constraints.sql`
- **Required Change:**
  1. Provision a local or containerized PostgreSQL 16+ instance (install Docker Desktop, WSL2 engine, or use native PostgreSQL service).
  2. Execute `npx prisma migrate deploy` to verify clean execution of all 63 tables and 85 foreign keys.
  3. Apply custom constraints from `prisma/sql/constraints.sql`.
  4. Run `npm run prisma:seed` and verify database hydration.
- **Dependencies:** Docker Desktop or PostgreSQL server installation on host.
- **Risk:** High (SQL dialect or syntax discrepancies could emerge upon live execution).
- **Verification Method:** Clean exit code from `prisma migrate deploy` and successful validation query on `_prisma_migrations`.
- **Acceptance Criteria:**
  - `prisma migrate status` reports database schema up to date with zero pending migrations.
  - Custom CHECK constraints and partial indexes are active in `information_schema.table_constraints`.

---

#### Task Card: BLK-P0-02 — Resolve Two-Factor Authentication Login Lockout
- **Task ID:** `BLK-P0-02`
- **Priority:** **P0 (Critical Blocker)**
- **Problem:** `AuthService.login()` explicitly throws `UnauthorizedException('Two-factor authentication is not yet supported')` when `user.twoFactorEnabled` is true. This prevents legitimate administrators from logging in if 2FA was toggled on.
- **Affected Files:**
  - `src/modules/auth/auth.service.ts` (lines 51–54)
  - `src/modules/auth/auth.controller.ts`
  - `src/modules/auth/dto/login.dto.ts`
- **Required Change:**
  - *Option A (Recommended for immediate launch):* Disallow setting `twoFactorEnabled = true` in user management until the full TOTP verification flow is ready, and provide an administrative reset.
  - *Option B (Full implementation):* Implement two-step authentication: emit a short-lived `twoFactorTicket` when credentials pass, followed by `POST /auth/verify-2fa` with a 6-digit TOTP code via `otplib`.
- **Dependencies:** None.
- **Risk:** Medium (Must not introduce bypass vulnerabilities).
- **Verification Method:** Unit test in `auth.service.spec.ts` asserting clean authentication behavior and denial of invalid TOTP codes.
- **Acceptance Criteria:**
  - An administrative user with 2FA enabled can either complete TOTP verification or the setting is safely decoupled until TOTP endpoints are live.

---

### 3.2 P1 — Required Before Initial Production Launch

---

#### Task Card: REQ-P1-01 — Prettier Formatting Alignment
- **Task ID:** `REQ-P1-01`
- **Priority:** **P1 (Launch Prerequisite)**
- **Problem:** `npm run format:check` fails across 188 source and test files due to style discrepancies with `.prettierrc`.
- **Affected Files:** All TypeScript files across `src/`, `test/`, and `prisma/`.
- **Required Change:** Execute `npm run format` and commit the formatting fixes in an isolated Git commit.
- **Dependencies:** Working tree must be clean beforehand.
- **Risk:** Extremely Low (Formatting changes only; zero AST or runtime impact).
- **Verification Method:** `npm run format:check` returns exit code 0.
- **Acceptance Criteria:** `npm run format:check` passes without errors.

---

#### Task Card: REQ-P1-02 — Automated Prisma Client Generation in Lifecycle Scripts
- **Task ID:** `REQ-P1-02`
- **Priority:** **P1 (Launch Prerequisite)**
- **Problem:** Running `npm test` or `npm run build` on a fresh clone without manually running `npx prisma generate` fails immediately.
- **Affected Files:** `package.json`
- **Required Change:**
  - Update `"build": "prisma generate && nest build"`
  - Add `"pretest": "prisma generate"`
- **Dependencies:** None.
- **Risk:** Low (Prisma generate takes < 300ms and requires zero database connection).
- **Verification Method:** Remove `node_modules/@prisma/client` and run `npm test`.
- **Acceptance Criteria:** `npm test` and `npm run build` execute reliably on fresh clones.

---

#### Task Card: REQ-P1-03 — Repair and Integrate Nested Module E2E Test Suites
- **Task ID:** `REQ-P1-03`
- **Priority:** **P1 (Launch Prerequisite)**
- **Problem:** Four nested E2E test files (`blog.e2e-spec.ts`, `faqs.e2e-spec.ts`, `products.e2e-spec.ts`, `testimonials.e2e-spec.ts`) located in `src/modules/*/test/` are omitted from `test/jest-e2e.json`.
- **Affected Files:**
  - `src/modules/blog/test/blog.e2e-spec.ts`
  - `src/modules/faqs/test/faqs.e2e-spec.ts`
  - `src/modules/products/test/products.e2e-spec.ts`
  - `src/modules/testimonials/test/testimonials.e2e-spec.ts`
  - `test/jest-e2e.json` or a new `jest-modules-e2e.json`
- **Required Change:** Standardize the test harness across these 4 suites using `FakePrismaService` or memory mock and register them in the E2E test runner.
- **Dependencies:** `REQ-P1-02`.
- **Risk:** Low.
- **Verification Method:** `npm run test:e2e` executes all 7 E2E suites cleanly.
- **Acceptance Criteria:** All nested E2E suites pass with exit code 0.

---

#### Task Card: REQ-P1-04 — Transactional Email Notification for Contact & Leads
- **Task ID:** `REQ-P1-04`
- **Priority:** **P1 (Launch Prerequisite)**
- **Problem:** Contact inquiries and project leads are saved to PostgreSQL, but no email notifications are dispatched to the MRM InfoTech sales team or customer.
- **Affected Files:**
  - `src/modules/contact/contact.service.ts`
  - `src/modules/contact/contact.module.ts`
  - New service: `src/common/services/mail.service.ts`
- **Required Change:** Integrate an asynchronous mail notification provider (using `@nestjs-modules/mailer`, Nodemailer, or Resend API) triggered on inquiry submission.
- **Dependencies:** SMTP or transactional email API credentials.
- **Risk:** Low (Failure to send email should be logged without aborting the database save).
- **Verification Method:** Unit test asserting mail dispatch event when inquiry is created.
- **Acceptance Criteria:** Administrative alerts and customer acknowledgment emails are dispatched upon lead creation.

---

#### Task Card: REQ-P1-05 — Production CI/CD Pipeline Configuration
- **Task ID:** `REQ-P1-05`
- **Priority:** **P1 (Launch Prerequisite)**
- **Problem:** No automated CI workflow exists to enforce quality gates on pull requests.
- **Affected Files:** `.github/workflows/ci.yml` (new file)
- **Required Change:** Create GitHub Actions workflow executing:
  1. `npm ci`
  2. `npm run prisma:generate`
  3. `npm run typecheck`
  4. `npm run lint`
  5. `npm run format:check`
  6. `npm test`
  7. `npm run build`
- **Dependencies:** None.
- **Risk:** None.
- **Verification Method:** Trigger GitHub Actions runner.
- **Acceptance Criteria:** All checks pass automatically on PR and push to `main`.

---

### 3.3 P2 — Important Post-Launch Improvements

---

#### Task Card: IMP-P2-01 — Cloud Object Storage Adapter for Media Assets
- **Task ID:** `IMP-P2-01`
- **Priority:** **P2 (Important Improvement)**
- **Problem:** Binary file uploads are not persisted to persistent cloud object storage (AWS S3, Cloudflare R2).
- **Affected Files:** `src/modules/media/media.service.ts`
- **Required Change:** Implement an S3-compatible storage adapter for binary asset streaming and presigned upload URLs.
- **Dependencies:** Cloudflare R2 or AWS S3 credentials.

---

#### Task Card: IMP-P2-02 — Distributed Redis Store for Rate Limiting & Throttler
- **Task ID:** `IMP-P2-02`
- **Priority:** **P2 (Important Improvement)**
- **Problem:** In-memory `ThrottlerGuard` is isolated to single container instances.
- **Affected Files:** `src/app.module.ts`
- **Required Change:** Configure Redis connection for `ThrottlerStorageRedisService`.
- **Dependencies:** Redis instance (e.g., Upstash or Valkey container).

---

### 3.4 P3 — Future Enhancements & CMS Extensions

---

#### Task Card: ENH-P3-01 — Dedicated Administrative Endpoints for Unwired CMS Models
- **Task ID:** `ENH-P3-01`
- **Priority:** **P3 (Future Enhancement)**
- **Models:** `Theme`, `Announcement`, `Subscriber`, `JobPosting`.
- **Scope:** Build dedicated controllers and services for marketing team self-service.

---
*End of Production Blockers and Prioritized Roadmap.*

