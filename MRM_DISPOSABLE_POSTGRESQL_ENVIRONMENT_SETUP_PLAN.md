# MRM InfoTech — Disposable PostgreSQL Environment Setup Plan

> **Task Reference:** TASK 04 — Disposable PostgreSQL Environment Preparation Assessment  
> **Date:** 31 October 2026  
> **Target Project:** `mrminfotech-backend` v0.1.0 (`d:\MRM\MRM_Backend`)  
> **Objective:** Safe, practical, step-by-step setup plan for a disposable local PostgreSQL database to test the initial Prisma migration (`20261030194410_init`).  
> **Status:** Assessment & Runbook Only. No software installed, no containers started, no database modified, and no migrations applied.

---

## 1. Existing Configuration Inspection

A comprehensive read-only audit of the repository configuration files revealed:

### 1.1 Docker Compose Configuration
- **File:** `d:\MRM\MRM_Backend\docker-compose.yml` (present; no `compose.yaml` or `Dockerfile` exists).
- **Service Name:** `db`
- **Container Name:** `mrm-dev-postgres`
- **PostgreSQL Image & Version:** `postgres:16-alpine` (PostgreSQL 16 on lightweight Alpine Linux).
- **Port Mapping:** `'5432:5432'` (binds host port 5432 to container port 5432).
- **Database Identity:**
  - `POSTGRES_USER`: `mrm_dev`
  - `POSTGRES_PASSWORD`: `[configured in docker-compose.yml for local development only]`
  - `POSTGRES_DB`: `mrm_web`
- **Storage / Volume Configuration:**
  - Mount: `mrm_pgdata:/var/lib/postgresql/data`
  - Persistence: Uses named Docker volume `mrm_pgdata`. Data persists across container restarts unless explicitly destroyed.
- **Healthcheck Configuration:**
  - Command: `pg_isready -U mrm_dev -d mrm_web`
  - Interval: `5s`, Timeout: `3s`, Retries: `10`
  - Guarantees container status reports `healthy` only when PostgreSQL is actively accepting connections.
- **Service Independence:** `db` is the **only** service defined in `docker-compose.yml`. It can be started independently without launching application containers or unwanted sidecars.

### 1.2 Environment & Connection Targets
- **Target in `.env`:** `DATABASE_URL=postgresql://mrm_dev:mrm_dev_password@localhost:5432/mrm_web?schema=public`
- **Target Verification:** The URL strictly targets `localhost:5432` with database `mrm_web`. It cannot connect to remote, staging, or production infrastructure.
- **Git Tracking:** Verified that `.env` is ignored by `.gitignore` and is untracked by Git.

---

## 2. Docker Desktop Feasibility Assessment

### 2.1 Host Environment Findings
- **Operating System:** Microsoft Windows 11 Pro 64-bit (Build 26300).
- **Hypervisor Status:** Verified active (`Virtualization-based security: Running`, `A hypervisor has been detected`).
- **Hardware Virtualization (SLAT / VT-x / AMD-V):** Enabled in BIOS/firmware.
- **Current Docker CLI State:** Not installed (`docker: command not found`).
- **Current Port 5432 State:** Closed / Unused (`TcpTestSucceeded: False`).

### 2.2 Feasibility Verdict: **FULLY FEASIBLE & RECOMMENDED**
Docker Desktop is the most practical, isolated, and standardized solution for this repository because:
1. **Zero Configuration Drift:** The repository already ships with a pre-configured `docker-compose.yml` tuned specifically for PostgreSQL 16.
2. **Architecture Match:** Uses the exact PostgreSQL 16 image matching the target production/staging engine.
3. **Hardware Ready:** Windows 11 Pro already has the hypervisor active, fulfilling all WSL 2 and Hyper-V prerequisites.
4. **Clean Isolation:** Avoids cluttering Windows system registry, background services, or global PATH with a native Windows PostgreSQL installer.

---

## 3. Disposable Database Isolation & Safety Principles

To ensure zero risk to existing systems, the local setup adheres to these safety principles:

| Safety Rule | Implementation |
|---|---|
| **Zero Remote Exposure** | `DATABASE_URL` strictly binds to `localhost:5432`. No external hosts permitted. |
| **Dedicated Identity** | Uses dedicated user `mrm_dev` and database `mrm_web`. |
| **No Existing Volume Overwrites** | Volume `mrm_pgdata` must be checked before migration. If previous tables exist, a clean disposable database name is used instead. |
| **No Data Destruction** | Never execute `docker compose down -v` (which deletes named volumes). |
| **Emptiness Verification** | Explicit verification query (`information_schema.tables`) must return `0` before any migration command is run. |

---

## 4. Step-by-Step Execution Runbook for the User

Follow these exact steps when ready to prepare the database and test the migration:

```mermaid
flowchart TD
    A["Step 1: Install Docker Desktop"] --> B["Step 2: Start Docker Desktop"]
    B --> C["Step 3: Start PostgreSQL Container\ndocker compose up -d db"]
    C --> D["Step 4: Check Health Status\ndocker compose ps"]
    D --> E["Step 5: Verify Empty Database\nSELECT count(*) = 0"]
    E --> F["Step 6: Future Migration Deploy\nnpx prisma migrate deploy"]
    F --> G["Step 7: Verify Schema & Seed\nnpm run prisma:seed"]
```

---

### Step 1: Install Docker Desktop (One-Time Setup)

Choose **one** of the following installation methods:

#### Method A: Via Windows Package Manager (`winget`) — Recommended
Open PowerShell as Administrator and run:
```powershell
winget install Docker.DockerDesktop
```

#### Method B: Manual Installer
1. Download Docker Desktop for Windows from the official portal:  
   https://www.docker.com/products/docker-desktop/
2. Run `Docker Desktop Installer.exe`.
3. Ensure the option **"Use WSL 2 instead of Hyper-V (recommended)"** is checked.
4. Complete installation and restart the computer if prompted.

---

### Step 2: Start Docker Desktop
1. Launch **Docker Desktop** from the Start Menu.
2. Accept the terms of service.
3. Wait approximately 30–60 seconds until the Docker whale icon in the Windows taskbar stays steady and the Docker Desktop dashboard shows **"Engine running"** (green indicator).
4. Verify the CLI is responsive in PowerShell:
   ```powershell
   docker --version
   docker compose version
   ```

---

### Step 3: Start Only the PostgreSQL Service
In PowerShell, navigate to the backend repository root and start the `db` service:
```powershell
Set-Location "d:\MRM\MRM_Backend"
docker compose up -d db
```
*Expected Output:*
```
[+] Running 2/2
 ✔ Network mrm_backend_default  Created
 ✔ Container mrm-dev-postgres   Started
```

---

### Step 4: Check PostgreSQL Readiness & Health Status
Wait 5–10 seconds for the internal health check to evaluate:
```powershell
docker compose ps
```
*Expected Output:*
The `STATUS` column must show **`Up (healthy)`** on port `0.0.0.0:5432->5432/tcp`.

You can also check the recent container logs:
```powershell
docker compose logs db --tail=15
```
*Expected Log Entry:* `database system is ready to accept connections`

---

### Step 5: Confirm Database Connection & Verify It Is Completely Empty

#### 5.1 Connection Ping:
```powershell
docker compose exec db pg_isready -U mrm_dev -d mrm_web
```
*Expected Output:* `mrm_web - accepting connections`

#### 5.2 Emptiness Verification:
Query PostgreSQL's catalog to prove that zero user tables exist in the `public` schema:
```powershell
docker compose exec db psql -U mrm_dev -d mrm_web -c "\dt"
```
*Expected Output:*
```
Did not find any relations.
```

Or query table count directly:
```powershell
docker compose exec db psql -U mrm_dev -d mrm_web -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
```
*Expected Output:* `count: 0`

> ⚠️ **CRITICAL ISOLATION GATE:**  
> If the count is greater than 0, the volume `mrm_pgdata` was used previously and contains preexisting data. **DO NOT APPLY THE MIGRATION TO A NON-EMPTY DATABASE.** Stop and inform the team, or target a clean database (e.g. `mrm_web_disposable`).

---

### Step 6: Verify Prisma Configuration Alignment
Confirm that Prisma recognizes the local database connection:
```powershell
npm run prisma:validate
```
*Expected Output:* `The schemas at prisma\schema are valid 🚀`

---

### Step 7: Future Migration Application (Task 05 Preview)
*(Do NOT run this command during Task 04. This is the command to run in the next task after human approval)*

```powershell
# Applies the reviewed initial migration: prisma/migrations/20261030194410_init/migration.sql
npx prisma migrate deploy
```
*Expected Output:*
```
1 migration found in prisma/migrations
Applying migration `20261030194410_init`
The following migration have been applied:
  - 20261030194410_init
All migrations have been successfully applied.
```

---

### Step 8: Future Migration Verification Commands
After applying the migration in Task 05, run these verification commands:

1. **Verify Migration Status:**
   ```powershell
   npm run prisma:migrate:status
   ```
   *Expected:* `1 migration found in prisma/migrations, 1 migration applied`

2. **Verify Created Tables:**
   ```powershell
   docker compose exec db psql -U mrm_dev -d mrm_web -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
   ```
   *Expected:* `64` (63 application tables + 1 `_prisma_migrations` table).

3. **Verify Custom Invariants:**
   ```powershell
   docker compose exec db psql -U mrm_dev -d mrm_web -c "SELECT conname FROM pg_constraint WHERE conname LIKE '%trust%' OR conname = 'lead_contactable';"
   ```
   *Expected:* Displays `client_trust`, `testimonial_trust`, `badge_trust`, `casestudy_trust`, `lead_contactable`.

4. **Verify Seed Execution:**
   ```powershell
   npm run prisma:seed
   ```
   *Expected:* `System data seed completed.`

5. **Verify Application Smoke Test:**
   ```powershell
   npm run start:dev
   ```
   In a separate terminal:
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:4000/api/v1/health" | Select-Object -ExpandProperty Content
   ```
   *Expected:* `{"status":"ok","db":"up"}`

---

### Step 9: Safe Cleanup Runbook (Preserving vs Disposing)

#### Option A: Pause / Stop (Preserves Database & Volume) — Recommended
When you finish testing for the day:
```powershell
docker compose stop db
```
Restart anytime with: `docker compose up -d db`.

#### Option B: Remove Container Only (Preserves Volume Data)
```powershell
docker compose down
```
*(Container is removed, but named volume `mrm_pgdata` remains intact).*

#### Option C: Reset / Full Disposal (Deletes All Data)
> ⛔ **WARNING:** This command permanently deletes all data inside `mrm_pgdata`. Only execute this when you explicitly want to discard the test database and start over from zero:
```powershell
# Only when explicit disposal is requested:
docker compose down -v
```

---

## 5. Prohibited Actions & Strict Boundaries

To safeguard repository and data integrity, the following actions remain **strictly prohibited** during this assessment:
- ❌ Running `npx prisma migrate deploy`
- ❌ Running `npx prisma migrate dev`
- ❌ Running `npx prisma migrate reset`
- ❌ Running `npx prisma db push`
- ❌ Running `npm run prisma:seed`
- ❌ Installing software without explicit user initiation
- ❌ Modifying any `.prisma` file, `migration.sql`, or application source code
- ❌ Executing `docker compose down -v`

---

## 6. Confirmation of System State

- **Database modified?** **NO.** Zero databases were created, modified, or connected to.
- **Migrations applied?** **NO.** The migration remains pending in `prisma/migrations/`.
- **Git working tree:** Only this planning report was added. Application source code and existing files remain untouched.

---

## 7. Recommended Next Step
1. User reviews this setup plan and installs Docker Desktop on the host machine.
2. User starts Docker Desktop and launches the container via `docker compose up -d db`.
3. Proceed to **Task 05: Apply Initial Migration & Live Seed Smoke Test**.

---
*Report compiled by Antigravity AI. Environment checks and configuration audited directly against Windows 11 Pro host state.*

