# Setup notes

## 1. Prisma model (ASSUMPTION - add only if you have no contact/inquiry model; needs a migration you approve)
```prisma
enum ContactStatus {
  NEW
  READ
  REPLIED
  ARCHIVED
}

model Contact {
  id           String        @id @default(uuid())
  name         String
  email        String
  phone        String?
  subject      String?
  message      String
  status       ContactStatus @default(NEW)
  internalNote String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}
```
Then: `npx prisma migrate dev --name add_contact`

## 2. Register
Add `ContactModule` to `AppModule` imports.

## 3. Global ValidationPipe (main.ts) - should already exist
```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
```

## 4. Rate limiting (optional)
If `@nestjs/throttler` is installed, add `@Throttle(...)` on POST /contact (see comment in controller).
Not added here because no new dependency is assumed.

## Gaps
- Email notifications NOT implemented (no known email service). Hook point: `// TODO(email)` in the service.
- `mode: 'insensitive'` assumes PostgreSQL.
- Admin list returns full records including message and internalNote (admin only).
