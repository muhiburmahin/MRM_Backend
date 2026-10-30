# FAQs API - setup notes (draft, not run)

## 1. Prisma model (ASSUMPTION - use your existing FAQ model if you have one; a new model needs an approved migration)
```prisma
model Faq {
  id          String   @id @default(uuid())
  question    String
  answer      String
  sortOrder   Int      @default(0)
  isPublished Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```
`npx prisma migrate dev --name add_faq` (development only). No category field is assumed.

## 2. Register
Copy `faqs/` to `src/modules/faqs/` and add `FaqsModule` to `AppModule`.

## 3. Routes
Public: GET /faqs, GET /faqs/:id  (published only; drafts return 404; only id, question, answer returned)
Admin:  GET/POST /admin/faqs, GET/PATCH/DELETE /admin/faqs/:id  (JwtAuthGuard + RolesGuard + Roles('ADMIN'))
Publish/unpublish = PATCH { isPublished }. Reorder = PATCH { sortOrder }.

## 4. Tests
Copy `test/faqs.e2e-spec.ts` next to the other e2e specs, then edit the helpers:
- `fake-prisma.ts`, in class FakePrisma add:
  `faq = new FakeModel(() => ({ isPublished: false, sortOrder: 0 }));`
- `create-app.ts`: import `FaqsModule` and add it to `imports`.
Run: `npx jest --config ./test/jest-e2e.json`

## Gaps / decisions
- Hard delete (no related models known). Unpublish instead if you want to keep history.
- No categories, bulk reorder, or translations. Say so if you need them.
- Answers are stored as plain text; if you render them as HTML on the frontend, sanitize first.
- `mode: 'insensitive'` assumes PostgreSQL.
