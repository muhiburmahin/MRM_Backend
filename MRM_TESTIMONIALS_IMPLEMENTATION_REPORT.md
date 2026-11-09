# MRM InfoTech — Testimonials Implementation Report

## 1. Original problem / starting state
A testimonial system **already existed, as uncommitted working-tree changes** in both repos (public + admin API, admin page and form, homepage section, service page block). I extended and repaired it rather than building a second one. Defects found in that state:

| # | Defect | Effect |
|---|--------|--------|
| 1 | `Testimonial` Prisma model gained 10 columns (companyName, avatarUrl, rating, serviceSlug, projectSlug, reviewDate, source, isFeatured, createdAt, updatedAt) with **no migration** | Any deploy against the migrated DB fails at runtime |
| 2 | `CreateTestimonialDto.quote` lost its validator when its type was widened; global pipe uses `forbidNonWhitelisted` | **Every create returned 400** ("property quote should not exist") — 7 of 15 existing e2e tests were failing |
| 3 | `getTestimonials()` in `lib/api/public.ts` had a corrupted template literal (TS1161) | **Frontend typecheck/build failed** |
| 4 | `revalidateTag(tag)` called with one argument (Next 16 needs a profile) | Typecheck failure |
| 5 | `FALLBACK_TESTIMONIALS` (invented clients/quotes) in source | Fabricated reviews shipped in the bundle (was unused) |
| 6 | Homepage header hardcoded "5.0 Client Satisfaction" | Fabricated statistic |
| 7 | No way to enable/disable the homepage section | Task requirement |
| 8 | `PATCH` with `null` for required fields (`authorName`, `quote`, …) passed validation (PartialType) | Reached Prisma → 500 / TypeError |
| 9 | `avatarUrl` unvalidated | Arbitrary scheme strings accepted |
| 10 | Project detail page had no related testimonials; case-study/service blocks reused the full-bleed homepage component | Task requirement / layout |

## 2. Files inspected
Backend: `testimonial.prisma`, `testimonials.service.ts`, both controllers, all DTOs, `NOTES.md`, `testimonials.e2e-spec.ts`, `fake-prisma.ts`, `site-settings` DTO/controller, migrations, `constraints.sql`. Frontend: homepage `page.tsx`, `ClientTestimonials.tsx`, `components/public/home/Testimonials.tsx` (unused older copy), `TestimonialForm.tsx`, admin testimonials page, `lib/api/{admin,public,types}.ts`, `types/homepage.ts`, `public-api.service.ts`, service/project/case-study pages, `globals.css` theme tokens.

## 3. Files changed
Backend
- `prisma/migrations/20261109120000_extend_testimonials/migration.sql` (new)
- `prisma/sql/constraints.sql` (rating check, parity with migration)
- `src/modules/testimonials/testimonials/dto/create-testimonial.dto.ts`
- `src/modules/testimonials/testimonials/testimonials.service.ts`
- `src/modules/testimonials/test/testimonials.e2e-spec.ts`
- `test/helpers/fake-prisma.ts`

Frontend
- `src/components/home/ClientTestimonials.tsx` (rewritten)
- `src/components/admin/forms/TestimonialsSectionSettings.tsx` (new)
- `src/app/admin/dashboard/testimonials/page.tsx`
- `src/types/homepage.ts`, `src/lib/api/public.ts`, `src/lib/api/admin.ts`
- `src/app/(public)/page.tsx`, `services/[slug]/page.tsx`, `projects/[slug]/page.tsx`, `case-studies/[slug]/page.tsx`
- `src/app/api/revalidate/route.ts`, `package.json`, `scripts/regression.test.mjs`

## 4. API / database changes
- **Migration** `20261109120000_extend_testimonials`: additive `ALTER TABLE "Testimonial" ADD COLUMN …` for the 10 columns (SQL produced by `prisma migrate diff` against the previous schema), plus `testimonial_rating_range CHECK ("rating" BETWEEN 1 AND 5)` guarded by `IF NOT EXISTS`, matching the existing invariants migration. Existing rows get defaults (rating 5, source "Direct Client").
- API: `quote` now required (`@IsDefined`); `avatarUrl` ≤ 500 chars and must be `/uploads/…` or `http(s)://…`; `PATCH` rejects `null` for `authorName`, `quote`, `rating`, `isFeatured`, `isVerified`, `showOnSite`, `sortOrder` with 400; optional fields (role, company, avatar, service, project, source, evidence) can still be cleared with `null`.
- Homepage section config lives in the existing `homepage.sections` site setting (new `testimonials` key, merged with defaults; RBAC `settings:write`). No new table.

## 5. Implementation details
- **Homepage**: section stays between Featured Projects and Why Choose MRM (the recommended order, already in place). Rendered only if `homepage.sections.testimonials.enabled` **and** at least one published testimonial exists; featured items are listed first and capped by `maxItems` (1–12, default 6).
- **Component**: theme tokens only (`--theme-*`), so all five themes apply. ≤ 3 items → responsive grid; > 3 → CSS scroll-snap carousel with labelled Previous/Next buttons, arrow-key support, focusable `role="region"` carousel, respects `prefers-reduced-motion`. Cards show photo (or initials), name, designation, company, rating, source/date and a verified badge, only when present. The summary rating is the **real average** of stored ratings. `inline` variant for detail pages.
- **Related testimonials**: service page (`serviceSlug`), project page and case-study page (`projectSlug`). Nothing renders when there are none; nothing is shown on unrelated pages.
- **Admin**: existing CRUD, verification/consent, featured, display order, image upload, service/project selection and publish toggle retained; new "Homepage Testimonials Section" panel controls visible/hidden, eyebrow, heading, description and max items. Backend RBAC unchanged (`content:read/write/delete/publish`).
- `NOTES.md` in the module is stale (describes an older draft schema) and was not updated.

## 6. Tests executed and actual results
- Backend `testimonials.e2e-spec.ts`: **20 passed** (15 existing — previously 7 failing — plus 5 new): slug/project/featured filtering, rating on public output, `null` clearing vs. retention, required-field `null` → 400, unsafe avatar URL / rating 0 and 6 / missing quote → 400, non-admin 403 / anonymous 401 on create-edit-delete.
- Full backend: `tsc --noEmit` clean; **265 unit and 108 e2e tests passed**.
- Frontend: `npm run typecheck` (includes 5-theme token/contrast lint) clean; `npm run build` succeeded; ESLint on touched files: 0 errors (32 pre-existing unused-import warnings in the homepage file); `npm test`: **14 passed**.

**Not done / not verified:** the migration SQL was **not applied to any database** (the configured DB is a remote hosted instance; the local Postgres needs credentials I do not have). Pages were **not viewed in a browser**: responsive behaviour, carousel interaction and the five themes' visual appearance are unverified beyond token lint and code review. The admin section panel was not exercised against a live API.

## 7. Remaining issues
- **Trust-rule bypass (pre-existing design, flagged not changed):** when an admin turns "show on site" on, `TestimonialsService` and the admin page auto-fill `isVerified = true`, an evidence note ("Verified client testimonial") and consent timestamp if blank. That makes the DB trust rule trivially satisfiable without real evidence/consent. Recommend requiring an explicit note and consent date in the UI.
- Saving the section panel writes the whole `homepage.sections` object; if the public settings fetch failed silently, defaults would overwrite earlier customisation.
- No production testimonials exist yet; the section stays hidden until real, verified entries are published. No sample data was added.
- Client-submitted testimonials / approval workflow: not implemented (not requested).
- Older unused `components/public/home/Testimonials.tsx` left in place.

## 8. Production deployment requirements
1. Apply the migration (`prisma migrate deploy`) **before** deploying the backend build; take a DB backup first.
2. Deploy backend, then frontend.
3. Ensure the admin role has `settings:write` (section toggle) and `content:write/publish` (testimonials).
4. In the admin, add real testimonials, verify evidence/consent, publish, then confirm the section on `/`, the matching service/project pages, and use "Purge cache".
