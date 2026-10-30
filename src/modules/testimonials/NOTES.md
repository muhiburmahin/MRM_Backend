# Testimonials API - setup notes (draft, not run)

## 1. Prisma model (ASSUMPTION - reuse your existing testimonial/review model if you have one; a new model needs an approved migration)
```prisma
model Testimonial {
  id           String   @id @default(uuid())
  customerName String
  designation  String?
  company      String?
  content      String
  rating       Int?     // 1-5, enforced in the DTO
  avatarUrl    String?
  isPublished  Boolean  @default(false)
  isFeatured   Boolean  @default(false)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```
`npx prisma migrate dev --name add_testimonial` (development only). Remove fields you do not need (e.g. rating, isFeatured).

## 2. Register
Copy `testimonials/` to `src/modules/testimonials/` and add `TestimonialsModule` to `AppModule`.

## 3. Routes
Public: GET /testimonials (filters: isFeatured; sort: sortOrder|createdAt|rating), GET /testimonials/:id  (published only)
Admin:  GET/POST /admin/testimonials, GET/PATCH/DELETE /admin/testimonials/:id  (JwtAuthGuard + RolesGuard + Roles('ADMIN'))
Publish / unpublish / feature / reorder = PATCH. New testimonials are ALWAYS drafts unless an admin sets isPublished.

## 4. Tests
Copy `test/testimonials.e2e-spec.ts`, then edit the helpers:
- `fake-prisma.ts`, in class FakePrisma add:
  `testimonial = new FakeModel(() => ({ designation: null, company: null, rating: null, avatarUrl: null, isPublished: false, isFeatured: false, sortOrder: 0 }));`
- `create-app.ts`: import `TestimonialsModule` and add it to `imports`.
Run: `npx jest --config ./test/jest-e2e.json`

## Gaps / decisions
- Testimonials are entered by admins only. There is NO public submission form or customer-verification workflow
  (none exists in the project that I know of). Tell me if you want a "submit for approval" endpoint.
- No seed/sample testimonials are created: content must be real customer quotes.
- Optional fields cannot be cleared to null with this DTO (send a new value, or tell me if you need null-clearing like in Company).
- Hard delete; unpublish with PATCH to keep the record.
