# MRM InfoTech — Regression Test & Verification Report

Date: 2026-11-09. Related: `MRM_LOGIN_EMAIL_AUTOFILL_FIX_REPORT.md`, `MRM_PROFILE_UPDATE_BUG_FIX_REPORT.md`, `MRM_TESTIMONIALS_IMPLEMENTATION_REPORT.md`.

## 1. Commands executed and actual results

| Scope | Command | Result |
|---|---|---|
| Backend typecheck | `npx tsc --noEmit -p tsconfig.json` | exit 0, no errors |
| Backend unit | `npx jest --runInBand` | **36 suites / 265 tests passed** |
| Backend e2e | `npx jest --config ./test/jest-e2e.json --runInBand` | **9 suites / 108 tests passed** |
| Frontend typecheck + theme lint | `npm run typecheck` | clean; "All 5 Themes Verified" (60-30-10 + WCAG contrast) |
| Frontend production build | `npm run build` | exit 0, 36/36 pages generated |
| Frontend ESLint (touched files) | `npx eslint …` | 0 errors, 32 warnings (unused imports already in `(public)/page.tsx`) |
| Frontend regression | `npm test` (`node --test`) | **14 / 14 passed** |

Before my changes: frontend typecheck failed (TS1161 in `lib/api/public.ts`, plus `revalidateTag` arity errors) and 7 of 15 backend testimonial e2e tests failed.

## 2. Checklist from the task

| Verification item | Status | Evidence / caveat |
|---|---|---|
| Login fields start empty | ✔ source-verified | regression test; no browser run |
| No personal email exposed | ✔ | email-shaped text removed from login page; test asserts none. The company contact address `contact.mrminfotech@gmail.com` is intentional public contact data elsewhere |
| Normal login still works | ◐ not run live | auth code unchanged except removal of dead fallback; backend auth tests pass (part of 265) |
| Profile text editable / fully clearable | ✔ at logic level | helper tests + backend e2e (mocked Prisma) |
| Empty optional fields persist | ✔ at service level | `null` stored in merged value; **no real DB row inspected** |
| New values persist after refresh | ◐ | form re-hydrates from stored record only; not exercised in browser |
| Unauthorized users cannot manage testimonials | ✔ | e2e: anonymous 401, non-admin 403 on POST/PATCH/DELETE |
| Admin CRUD works | ✔ at API level | e2e create/read/update/delete, publish toggle |
| Published appear / unpublished hidden | ✔ | e2e public list and by-id |
| Homepage section visibility control | ◐ | code + source test; admin panel not exercised live |
| Responsive behaviour | ✘ not verified | no browser/device testing |
| All five themes functional | ◐ | token lint passes; component uses only `--theme-*` tokens; not viewed |
| Existing pages not broken | ◐ | full build + all backend suites pass; no visual check |

Legend: ✔ verified by an executed test · ◐ partially verified · ✘ not verified.

## 3. Regression tests added
- Backend `company.e2e-spec.ts` (+6), `testimonials.e2e-spec.ts` (+5); `fake-prisma.ts` extended (multi-key `orderBy`, new testimonial columns).
- Frontend `scripts/regression.test.mjs` (14 tests; run via `npm test`).

## 4. Other defects found while verifying (fixed)
- Frontend compile error and `revalidateTag` signature errors (above).
- Plaintext new-password storage in `localStorage` on the login page.
- Testimonial create always returning 400.

## 5. Remaining issues
See the three feature reports. Highlights: migration not applied to any DB; no browser/visual/responsive/theme verification; testimonial auto-verification bypass; unauthenticated `/api/revalidate`.

## 6. Environment notes
- Several repo files were modified during the session by something other than me (the service and case-study pages gained testimonial blocks mid-session). Both repos contain extensive **other uncommitted changes** (team module, `auth.controller.ts`, `AdminSidebar`, `TeamForm`, etc.) that I did not touch or review; everything is uncommitted and nothing was committed by me.
- Files use CRLF line endings; edits preserved them.

## 7. Production deployment requirements
Apply migration `20261109120000_extend_testimonials` first, then backend, then frontend; run the checks in section 2 marked ◐/✘ in a staging environment (browser, mobile widths, all five themes, live login, real DB row check) before release.
