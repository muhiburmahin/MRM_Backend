# MRM InfoTech — Profile Update Bug Fix Report

## 1. Original problem
Text in an editable profile could not reliably be removed and saved; old demo text came back after saving or refreshing.

**Scope note:** there is no end-user profile endpoint in this project (`User` has name/email/avatar only and no update route besides `change-password`). The profile that holds editable text with built-in demo defaults is the **Company Profile** (Admin → Settings, `PATCH /api/v1/admin/company`, stored as `SiteSetting` key `company.profile`). That is the flow I traced and fixed. If a different "profile" was meant (e.g. Team member bios), tell me and I will trace that one too.

## 2. Root cause
The **backend was correct**. `UpdateCompanyDto` turns `''` into `null`, and `CompanyService.save()` merges only `undefined`-filtered keys, so `null` clears and an omitted key retains. The bugs were all in the frontend:

1. `CompanyProfileForm` initialised from `FALLBACK_COMPANY_PROFILE` (demo text/URLs/phone) and merged the server record over it (`{...fallback, ...data}`). Any key absent from the stored record kept the demo value, and **the whole form (demo included) was then saved back**.
2. `updateAdminCompanyProfile` replaced a blank name with `'MRM InfoTech'` silently.
3. *Founded Year* could not be cleared: `value={foundedYear || 2024}` and `parseInt(...) || 2024`.
4. After saving, the form was not refreshed from the server response (UI showed local state, not what was persisted).
5. The public footer re-introduced deleted text: `company.description || FALLBACK.description`, and merged `{...fallback, ...data}`.
6. "Reset Defaults" restored demo values into the form, one click from being saved.
7. The public cache (60 s ISR) was not purged after a save.

## 3. Files inspected
Frontend: `CompanyProfileForm.tsx`, `lib/api/admin.ts`, `lib/api/public.ts`, `lib/api/client.ts`, `components/public/shared/Footer.tsx`, `components/layout/Footer.tsx` (unused), `app/api/revalidate/route.ts`, `AdminHeader.tsx`. Backend: `admin-company.controller.ts`, `company.service.ts`, `update-company.dto.ts`, `validation.pipe.ts`, `company.e2e-spec.ts`, `user.prisma`.

## 4. Files changed
- `src/lib/company-profile.ts` (new, dependency-free helpers `formFromServer`, `buildCompanyPatch`)
- `src/components/admin/forms/CompanyProfileForm.tsx`
- `src/lib/api/admin.ts` (`updateAdminCompanyProfile`)
- `src/components/public/shared/Footer.tsx`
- `scripts/regression.test.mjs`
- Backend: `src/modules/company/test/company.e2e-spec.ts` (regression tests only; no production code change)

## 5. API / database changes
None. Payload contract is now explicit: every editable field is sent; empty → `null` (clears); non-empty → replaces; `logoUrl` (no form control) is omitted so the server retains it.

## 6. Implementation details
- Form state is built only from the stored record; absent/null → `''`. Nothing from the demo fallback enters the form.
- Patch builder trims; blank optional → `null`; blank `name` or `email` → client-side error ("is required") rather than a substituted default; Founded Year may be cleared, must be an integer otherwise (server enforces 1800–2100).
- On save, the form is re-populated from the PATCH response, then `/api/revalidate` is called (best effort).
- "Reset Defaults" is now "Discard Changes" and restores the last saved values.
- Public footer uses the stored record as-is on success; fallback content is only the initial/API-failure state.

## 7. Tests executed and actual results
- Backend `company.e2e-spec.ts` (run with the e2e config): **8 passed** (2 existing + 6 new): empty string → `null` and cleared in persisted value; omitted field retained; new text replaces old; `foundedYear` `''`/`null` clears; `name: ''` rejected; invalid email still rejected.
- Frontend `npm test`: 6 profile tests **passed** (no demo leakage, blank → null, year clearing/validation, required fields not defaulted, `logoUrl`/`isPublic` omitted, footer/form source no longer reference fallbacks).
- Full backend suites after the change: 265 unit + 108 e2e **passed**.

**Not done:** the backend tests use a mocked Prisma, so I did **not** inspect a real database row, and I did not exercise the form in a browser or capture live API request/response pairs. The remote database in `.env` is a hosted instance and was deliberately not touched.

## 8. Remaining issues
- `POST/GET /api/revalidate` is unauthenticated (pre-existing); anyone can trigger a cache purge.
- Footer first paints fallback content until the client fetch returns (pre-existing behaviour, unchanged).
- `isPublic: true` is still sent on every save (pre-existing); a profile deliberately set private would be re-published by the next save.

## 9. Production deployment requirements
Frontend redeploy. No migration. Existing stored profiles load correctly; fields that were never saved will now appear empty in the admin form instead of showing demo text, so an admin should review and complete the form once.
