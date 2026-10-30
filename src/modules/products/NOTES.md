# Products API - setup notes (draft, not run)

## 1. Prisma model (ASSUMPTION - use your existing Product model if you have one; a new model needs an approved migration)
```prisma
model Product {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  description String?
  price       Decimal? @db.Decimal(10, 2)
  imageUrl    String?
  isPublished Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```
`npx prisma migrate dev --name add_product` (development only).

## 2. Register
Copy `products/` to `src/modules/products/` and add `ProductsModule` to `AppModule`.

## 3. Routes
Public:  GET /products, GET /products/:slug  (published only; drafts return 404)
Admin:   GET/POST /admin/products, GET/PATCH/DELETE /admin/products/:id  (JwtAuthGuard + RolesGuard + Roles('ADMIN'))
Rename `admin/products` if your project uses another convention.

## 4. Tests
Copy `test/products.e2e-spec.ts` next to the other e2e specs, then make two small edits to the earlier e2e helpers:
- `test/helpers/fake-prisma.ts`, inside class FakePrisma add:
  `product = new FakeModel(() => ({ isPublished: false, description: null, price: null, imageUrl: null }));`
- `test/helpers/create-app.ts`: import `ProductsModule` and add it to `imports: [MediaModule, ContactModule, ProductsModule]`.
Run: `npx jest --config ./test/jest-e2e.json`

## Gaps / decisions for you
- Delete is a hard delete with NO reference check (no related models known). Unpublishing via PATCH isPublished=false is the safe alternative.
- Fake DB does not enforce the unique slug; the 409 test mocks Prisma's P2002 error. A real-DB test is still needed.
- `mode: 'insensitive'` assumes PostgreSQL.
- Categories, inventory, orders, payments are NOT included (out of scope).
