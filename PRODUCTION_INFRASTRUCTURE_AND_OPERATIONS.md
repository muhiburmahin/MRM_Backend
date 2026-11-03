# ==============================================================================
# MRM InfoTech Backend — Production Infrastructure & Operations Guide
# ==============================================================================

## 1. Executive Summary & Audit Matrix (Phases 0 to 15)

| Phase | Subsystem | Scope | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Repository Audit | Core infrastructure, modular layout & dependencies | **COMPLETE** |
| **Phase 1** | Application Architecture | Predictable bootstrap, body limits, Helmet, CORS | **COMPLETE** |
| **Phase 2** | Configuration Management | Fail-fast typed environment validation & `.env.example` | **COMPLETE** |
| **Phase 3** | Global Error Handling | Standardized error shape, Prisma mapper & validation details | **COMPLETE** |
| **Phase 4** | Global Response Standard | Uniform response wrappers, pagination & sensitive field stripping | **COMPLETE** |
| **Phase 5** | Validation & Transformation | Nested DTO error extraction & global validation pipe | **COMPLETE** |
| **Phase 6** | Middleware & Request Context | Safe Request ID correlation & timing headers (`X-Response-Time`) | **COMPLETE** |
| **Phase 7** | Authentication & RBAC | Argon2id, session cookies, TOTP 2FA & fail-closed `PermissionsGuard` | **COMPLETE** |
| **Phase 8** | Security Hardening | File magic-byte checks, filename sanitization & client IP resolution | **COMPLETE** |
| **Phase 9** | Database & Prisma Safety | Lifecycle hooks, connection resilience & managed transactions | **COMPLETE** |
| **Phase 10**| Observability & Health Probes | `/health`, `/health/live`, `/health/ready` with safe telemetry | **COMPLETE** |
| **Phase 11**| Query Performance | Pagination boundaries (`max: 100`) & projection optimizations | **COMPLETE** |
| **Phase 12**| Background Jobs & Storage | Non-blocking fault-tolerant email & local upload fallback | **COMPLETE** |
| **Phase 13**| Audit Logging | Redacted administrative audit trail & security events | **COMPLETE** |
| **Phase 14**| API Documentation | OpenAPI 3.0 at `/docs` with cookie auth & CSP allowance | **COMPLETE** |
| **Phase 15**| Deployment Readiness | Containerized multi-stage Dockerfile & operations runbook | **COMPLETE** |

---

## 2. Active Security Controls

1. **Password Hashing:** Argon2id with recommended OWASP memory and iteration parameters (`hash()` / `verify()`).
2. **Multi-Factor Authentication (2FA):** TOTP (RFC 6238) with AES-256-GCM encrypted secrets at rest and recovery code hashes.
3. **Session Management:** Cryptographically signed, HttpOnly, SameSite cookie sessions with IP salt hashing and active revocation.
4. **Authorization (RBAC):** Fail-closed `PermissionsGuard`. Any endpoint missing `@Permissions(...)` or `@Public()` defaults to 403 Forbidden.
5. **CSRF & Origin Security:** `OriginGuard` verifies explicit allow-listed origins on mutating HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`).
6. **Rate Limiting:** IP-aware `ThrottlerGuard` respecting proxy trust count (default: 120 requests per 60s window).
7. **HTTP Security Headers:** `helmet` sets strict Content-Security-Policy, HSTS, X-Content-Type-Options, and Frameguard.
8. **File Upload Hardening:** Extension whitelist, path traversal sanitization, and MIME-type integrity validation.
9. **Sensitive Field Stripping:** Automatic redaction of `passwordHash`, `twoFactorSecretEnc`, and `tokenHash` from all outgoing payloads.

---

## 3. Database Migration & Neon PostgreSQL Guidelines

1. **Local Development Migrations:**
   ```bash
   npm run prisma:migrate:dev
   ```
2. **Production Zero-Downtime Deployment:**
   ```bash
   npx prisma migrate deploy
   ```
3. **Database Health Verification:**
   ```bash
   curl -f http://localhost:4000/api/v1/health/ready
   ```
4. **Data Seed (Initial Role & Admin Provisioning):**
   ```bash
   npm run prisma:seed
   ```

---

## 4. Production Deployment & Runtime Commands

### Native Node.js Deployment:
```bash
# 1. Install production dependencies
npm ci --omit=dev

# 2. Generate Prisma Client
npx prisma generate

# 3. Build application
npm run build

# 4. Start production server
npm run start:prod
```

### Docker Multi-Stage Deployment:
```bash
# 1. Build optimized container image
docker build -t mrminfotech-backend:latest .

# 2. Run container with environment configuration
docker run -d \
  -p 4000:5000 \
  --env-file .env \
  --name mrm-backend \
  mrminfotech-backend:latest
```

---

## 5. Health Check Probes Reference

- **Liveness Probe:** `GET /api/v1/health/live` (or `/api/v1/health`)
  - Status: 200 OK
  - Queries: Process memory (`rss`, `heapUsed`) and uptime without database overhead.
- **Readiness Probe:** `GET /api/v1/health/ready`
  - Status: 200 OK when database answers `SELECT 1` within 2 seconds.
  - Status: 503 Service Unavailable when database is unreachable.
  - Zero sensitive hostnames or credentials exposed.

