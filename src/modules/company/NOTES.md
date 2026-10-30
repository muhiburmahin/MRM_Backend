# Company API - setup notes (draft, not run)

## 0. Assumption: ONE global company profile (no multi-tenancy). Tell me if your project has multiple companies/tenants.

## 1. Prisma model (ASSUMPTION - use your existing company/settings model if you have one; a new model needs an approved migration)
```prisma
model Company {
  id          String   @id            // always "main" -> only one row can exist
  name        String
  tagline     String?
  description String?
  logoUrl     String?
  email       String?
  phone       String?
  address     String?
  website     String?
  facebookUrl String?
  linkedinUrl String?
  foundedYear Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```
`npx prisma migrate dev --name add_company` (development only). Only keep the fields your site really needs.

## 2. Register
Copy `company/` to `src/modules/company/` and add `CompanyModule` to `AppModule`.

## 3. Routes
Public: GET /company  (404 until the profile exists)
Admin:  GET /admin/company, PATCH /admin/company  (JwtAuthGuard + RolesGuard + Roles('ADMIN'))
First PATCH creates the profile (name required); later PATCHes update it. `null` clears optional fields.
There is no DELETE (the profile is a singleton).

## 4. Tests
Copy `test/company.e2e-spec.ts` next to the other e2e specs, then edit the helpers:
- `fake-prisma.ts`, in class FakePrisma add:
  `company = new FakeModel(() => ({ tagline: null, description: null, logoUrl: null, email: null, phone: null, address: null, website: null, facebookUrl: null, linkedinUrl: null, foundedYear: null }));`
- `create-app.ts`: import `CompanyModule` and add it to `imports`.
Run: `npx jest --config ./test/jest-e2e.json`

## Gaps / decisions
- Everything stored in this profile is returned by the PUBLIC endpoint. Do not put private data in it.
- Logo: store the URL returned by the Media upload (`/uploads/...`); this module does not upload files.
- A 404 for a missing profile is my choice; switch to an empty object if your frontend prefers.
- Mission/vision/values, multiple offices, and opening hours are NOT included.
