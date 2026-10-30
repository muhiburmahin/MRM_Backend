# Phase 1 checklist: typecheck, lint, and build

**Baseline inspected:** 2026-10-11  
**Scope:** inspection only; no application-code, dependency, schema, migration, or route-wiring changes were made.

## Baseline commands

| Command | Result |
|---|---|
| `git status --short --branch` | Could not run successfully: `E:\Full Stack Project\MRM\MRMinfotech-backend` is not a Git repository (`.git` directory is absent). Existing worktree changes therefore could not be distinguished. |
| `npm run typecheck` | Failed: **111 TypeScript diagnostics** — TS2307: 70; TS2349: 34; TS2724: 3; TS2694: 2; TS7016: 1; TS7006: 1. |
| `npm run lint` | Failed: **73 errors** — `@typescript-eslint/no-explicit-any`: 67; `no-useless-escape`: 5; `@typescript-eslint/no-unused-vars`: 1. |
| `npm run build` | Failed: **77 TypeScript diagnostics** — TS2307: 64; TS2349: 6; TS2724: 3; TS2694: 2; TS7016: 1; TS7006: 1. Test files are not fully excluded by `tsconfig.build.json` because `.e2e-spec.ts` does not match its `**/*.spec.ts` exclusion. |
| `npm run test:e2e -- --runInBand --runTestsByPath test/health.e2e-spec.ts` | Passed: **1 suite, 8 tests**. |
| `npm run prisma:validate` | Passed: the multi-file schema under `prisma/schema` is valid. |

`package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.build.json`, `eslint.config.mjs`, the Prisma schema
configuration and the schema model files were inspected. The schema currently declares **63 models and 14 enums**.
The TypeScript totals are diagnostics, not unique root causes: multiple files report the same missing module.

## (a) Dependency gaps — address before dependent code fixes

- [ ] `argon2` is imported by `src/auth/password.service.ts` but is absent from both `package.json` and the lockfile.
- [ ] The media controller imports `multer` and uses `Express.Multer.File`. `multer` exists only transitively through
  `@nestjs/platform-express` in the installed dependency tree; it is not declared directly. `@types/multer` is absent
  from `package.json` and the lockfile. This corresponds to the missing declaration / `Express.Multer` diagnostics.
- [ ] **Approval required before installation or manifest edits.** Proposed packages: runtime `argon2`; runtime
  `multer` as a direct dependency if the import remains; development `@types/multer`. No package was installed or
  changed during inspection.

## (b) Broken or unresolved import paths

- [ ] Prisma imports across admin and older feature code point to `../../prisma/prisma.module` or
  `../../prisma/prisma.service`; the actual provider is `src/database/prisma.service.ts`, exported by
  `src/database/database.module.ts`. There are **18 TS2307 diagnostics** for these two unresolved targets.
- [ ] Eight source/test locations each import absent `./helpers/create-app`, `./helpers/test-guards`, and
  `./helpers/fake-prisma` (**24 TS2307 diagnostics**). The helpers do not exist at those paths.
- [ ] The above missing imports contribute to the **70 TS2307 diagnostics** overall. The 27 unresolved JWT/roles
  imports are also auth-contract problems and are cross-listed in section (d).
- [ ] **34 TS2349 diagnostics** come from e2e files importing `supertest` as a namespace (`import * as request`)
  and then calling it as a function. `@types/supertest` is already declared; this is an import/type-usage issue,
  not a missing-package finding.

## (c) Prisma model / field mismatches

The Prisma schema is the source of truth and must not be changed to accommodate old service assumptions.

- [ ] **Contact is not a schema model.** The compiler reports missing `Prisma.ContactWhereInput` and
  `ContactStatus` types. The schema has `Lead` and `LeadStatus`. `ContactService` also creates records from only
  name/email/phone/subject/message, while `Lead` requires `ref`, `type`, and `consentAt` and has no `subject` field.
  This needs a product/data-contract decision; do not invent defaults or silently change public request behavior.
- [ ] **Admin dashboard uses old model/field names.** `AdminService` refers to `contact`, `blogPost`, and `media`;
  schema models are `Lead`, `Post`, and `MediaAsset`. It also filters `Product.isPublished`, which is absent from
  `Product` (publication lives in related translations/status data rather than that boolean).
- [ ] **Blog code uses old model shape.** The service references `blogPost`; schema has `Post` and
  `PostTranslation`. Slug/title/body/publish state are translation fields, not root `Post` fields.
- [ ] **Media code uses a different persistence shape.** The service references `media` and writes
  `filename`, `originalName`, and `size`; schema has `MediaAsset` with `storageKey`, `fileName`, and `sizeBytes`.
  Reconcile only after deciding how local upload storage maps to the schema's storage-key contract.
- [ ] **Testimonials code uses absent fields.** The service expects fields such as `customerName`, `designation`,
  `company`, `content`, `rating`, `avatarUrl`, `isPublished`, and `isFeatured`; schema `Testimonial` instead has
  `authorName`, `authorRole`, `quote`, `isVerified`, `evidenceNote`, `consentAt`, and `showOnSite`.
- [ ] Other feature-service model/field errors may be masked until unresolved Prisma imports are corrected. Re-run
  typecheck after the import group before deciding whether any additional reconciliation is safe.

## (d) Session-cookie auth contract mismatches — do not alter without approval

- [ ] The implemented auth design is session-cookie based (`AuthGuard`, `SessionService`, and cookie helpers).
  Several admin/feature controllers instead import nonexistent `JwtAuthGuard`, `RolesGuard`, and `Roles` and use
  `@Roles('ADMIN')`. These account for 27 missing-import diagnostics across nine controller files. Do not add a
  second JWT auth system as a typecheck shortcut.
- [ ] `AuthModule` is not registered in `AppModule`; `AppModule` currently keeps only `HealthModule` registered
  (plus shared infrastructure). Do not wire additional modules or change route exposure in this phase.
- [ ] Newer controllers use the session `@Permissions(...)` metadata, while the globally registered
  `src/common/guards/permissions.guard.ts` uses a separate permissions metadata contract and always denies
  protected routes. `AuthModule` contains its own session-aware permission guard, but that module is not active.
- [ ] Agree the canonical auth metadata/guard integration before fixing legacy controller authorization. No guard
  contract, permissions metadata, route wiring, or authentication architecture was changed during inspection.

## (e) Lint-only issues

- [ ] Replace the **67 explicit `any` lint errors** with schema/client-derived types, DTO types, or `unknown` plus
  validation; do not disable the lint rule.
- [ ] Fix **5 `no-useless-escape`** findings in regular expressions.
- [ ] Fix **1 unused-variable** finding.
- [ ] Re-run lint after the type/import and schema-contract groups so errors caused by unresolved dependencies are
  not confused with the remaining lint-only baseline.

## Stop point / approvals before implementation

This checklist is the end of Step 1. **No source code has been changed.** The only newly requested file is this
checklist. Before Step 2:

1. Reply **`continue`** to authorize code fixes in the listed order.
2. Separately approve any dependency additions before package manifests or lockfiles are changed.
3. Decide how the public contact submission maps to `Lead` (including required consent, lead type, reference generation,
   and whether the old `subject` input is to be removed or represented elsewhere). If that contract cannot be decided
   safely, leave Contact as a documented blocker.
4. Approve any auth guard/metadata contract decision before touching authentication or protected controllers.

No Prisma schema change, migration, database command, new feature, module registration, or route behavior change is
authorized by this checklist.
