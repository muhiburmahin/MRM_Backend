# MRM InfoTech Backend: Remaining Production Blockers

**Project:** MRM InfoTech Official Corporate Website Backend  
**Date:** October 31, 2026  
**Reference Document:** [`MRM_PRODUCTION_HARDENING_IMPLEMENTATION_REPORT.md`](file:///d:/MRM/MRM_Backend/MRM_PRODUCTION_HARDENING_IMPLEMENTATION_REPORT.md)  

---

## 1. Overview of Remaining Blockers

With the successful completion of Master Task 02, all non-database-dependent application defects, 2FA workflows, test integrations, formatting issues, and CI configurations have been fully resolved and verified.

The remaining blockers are strictly **external, environmental, and credential-dependent**:

| Blocker ID | Severity | Category | Description | Dependency to Unblock |
|---|---|---|---|---|
| **BLK-ENV-01** | **P0 (Critical)** | Environment | Docker / Local PostgreSQL unavailable on Windows host. The 1,280-line initial migration (`20261030194410_init`) and `constraints.sql` have not been executed on a live database. | Install Docker Desktop or configure local/remote PostgreSQL instance. |
| **BLK-ENV-02** | **P0 (Critical)** | Environment | Live Database Seed execution unverified against a real PostgreSQL database. | Requires PostgreSQL instance from `BLK-ENV-01`. |
| **BLK-OPS-01** | **P1 (Launch)** | Configuration | Transactional Email Provider Credentials (SMTP, SendGrid, or Resend) not configured in production `.env`. (The backend abstraction and notification fallbacks are fully implemented). | Provide production SMTP host/port/user/pass or transactional API keys. |
| **BLK-OPS-02** | **P2 (Improvement)**| Storage | Cloud Object Storage Adapter for media assets (Cloudflare R2 or AWS S3). | Provision R2/S3 bucket credentials. |
| **BLK-OPS-03** | **P2 (Improvement)**| Caching | Distributed Redis store for `ThrottlerGuard` in multi-instance container deployments. | Provision Redis/Valkey instance. |

---

## 2. Detailed Blocker Analysis

### BLK-ENV-01: Live Initial PostgreSQL Migration Execution
- **Current State:** Migration `prisma/migrations/20261030194410_init/migration.sql` was generated offline and statically validated.
- **Why It Is Blocked:** Docker Desktop is not installed on the Windows host, and port 5432 has no active PostgreSQL engine.
- **Required Action:**
  1. Install Docker Desktop or start a remote disposable PostgreSQL 16+ instance.
  2. Execute `npx prisma migrate deploy`.
  3. Apply custom constraints: `prisma/sql/constraints.sql`.
  4. Verify that all 63 tables, 85 foreign keys, 6 CHECK constraints, and 2 partial indexes are created in PostgreSQL.

### BLK-ENV-02: Live Database Seed & Initial Administrator Provisioning
- **Current State:** `prisma/seed.ts` is implemented and compiles, but has not been executed against a live database.
- **Required Action:** Run `npm run prisma:seed` and verify default roles, system permissions, and initial owner setup.

### BLK-OPS-01: Production Transactional Email Configuration
- **Current State:** `MailService` is implemented, tested with mock transport, and wired to `ContactService`. In the absence of credentials, it operates in safe dry-run mode without crashing lead submissions.
- **Required Action:** Populate `.env` with production SMTP credentials:
  ```ini
  MAIL_ENABLED=true
  MAIL_FROM="MRM InfoTech <no-reply@mrminfotech.com>"
  MAIL_NOTIFY_RECIPIENT="leads@mrminfotech.com"
  SMTP_HOST=smtp.sendgrid.net
  SMTP_PORT=587
  SMTP_USER=apikey
  SMTP_PASSWORD=<production-secret>
  ```

---
*End of Remaining Production Blockers.*

