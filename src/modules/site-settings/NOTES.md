# Site Settings API - setup notes (draft, not run)

## 0. IMPORTANT: overlap with the Company module
Company (already delivered) also has `logoUrl`, contact details and social links. Decide ONE owner for each value:
- Suggested split: Company = business facts (name, address, phone, email, social, founded year);
  Site Settings = website presentation (site name, logo, favicon, default SEO, footer text).
- `logoUrl` exists in both in my drafts. Remove it from one of them, or drop this module and add the SEO/favicon/footer
  fields to Company instead. Your brief says not to create duplicate settings storage - tell me which you prefer.

## 1. Assumption: ONE global settings record (no multi-tenancy, no key-value store).

## 2. Prisma model (ASSUMPTION - reuse your existing settings model if you have one; a new model needs an approved migration)
```prisma
model SiteSettings {
  id              String   @id          // always "main" -> only one row can exist
  siteName        String
  siteDescription String?
  logoUrl         String?
  faviconUrl      String?
  seoTitle        String?
  seoDescription  String?
  seoImageUrl     String?
  footerText      String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```
`npx prisma migrate dev --name add_site_settings` (development only).
Do NOT add secrets, API keys or behaviour switches (e.g. maintenance mode) to this table.

## 3. Register
Copy `site-settings/` to `src/modules/site-settings/` and add `SiteSettingsModule` to `AppModule`.

## 4. Routes
Public: GET /site-settings  (404 until created; returns an explicit field list, never the raw row)
Admin:  GET /admin/site-settings, PATCH /admin/site-settings  (JwtAuthGuard + RolesGuard + Roles('ADMIN'))
First PATCH creates (siteName required); later PATCHes update. `null` clears optional fields. No DELETE.

## 5. Tests
Copy `test/site-settings.e2e-spec.ts`, then edit the helpers:
- `fake-prisma.ts`, in class FakePrisma add:
  `siteSettings = new FakeModel(() => ({ siteDescription: null, logoUrl: null, faviconUrl: null, seoTitle: null, seoDescription: null, seoImageUrl: null, footerText: null }));`
- `create-app.ts`: import `SiteSettingsModule` and add it to `imports`.
Run: `npx jest --config ./test/jest-e2e.json`

## Caching
None added (no cache infrastructure known). Every public read is one primary-key lookup. If you add a cache later,
invalidate it inside `save()`.

## Gaps / decisions
- Images are stored as URL strings (use the Media upload result); this module does not upload files.
- A 404 for missing settings is my choice; an empty object is the alternative.
- Theme/colour preferences, analytics IDs and per-language settings are NOT included.
