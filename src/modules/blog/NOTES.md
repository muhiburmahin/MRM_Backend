# Blog API - setup notes (draft, not run)

## 1. Prisma model (ASSUMPTION - use your existing blog model if you have one; a new model needs an approved migration)
```prisma
model BlogPost {
  id            String    @id @default(uuid())
  title         String
  slug          String    @unique
  excerpt       String?
  content       String
  coverImageUrl String?
  isPublished   Boolean   @default(false)
  publishedAt   DateTime?
  authorId      String?   // plain column, no relation assumed
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```
`npx prisma migrate dev --name add_blog_post` (development only). If you want a real author relation to your User model, tell me the model name first.

## 2. Register
Copy `blog/` to `src/modules/blog/` and add `BlogModule` to `AppModule`.

## 3. Routes
Public: GET /blog, GET /blog/:slug  (published only; drafts return 404; list omits content)
Admin:  GET/POST /admin/blog, GET/PATCH/DELETE /admin/blog/:id  (JwtAuthGuard + RolesGuard + Roles('ADMIN'))

## 4. Tests
Copy `test/blog.e2e-spec.ts` next to the other e2e specs, then edit the helpers:
- `fake-prisma.ts`, in class FakePrisma add:
  `blogPost = new FakeModel(() => ({ isPublished: false, publishedAt: null, excerpt: null, coverImageUrl: null, authorId: null }));`
- `create-app.ts`: import `BlogModule` and add it to `imports`.
Run: `npx jest --config ./test/jest-e2e.json`

## Gaps / decisions
- `content` is stored as plain text/Markdown. If an admin can enter HTML, the frontend MUST sanitize before rendering (stored XSS risk).
- Hard delete, no reference check (no related models known). Unpublish with PATCH isPublished=false instead.
- Categories/tags, comments, scheduled publishing are NOT included.
- `mode: 'insensitive'` assumes PostgreSQL. The fake DB does not enforce unique slugs (409 test mocks Prisma's P2002).
