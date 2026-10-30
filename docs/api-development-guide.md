# API development guide

How to add one feature module. Follow this exactly so every module looks the same. Implement **one coherent module per task**.

## 0. Before you write code

1. Read the module's models in `prisma/schema/` and the SRS section it belongs to. Use the real field names.
2. Check `docs/implementation-status.md` and the existing modules; reuse, do not duplicate.
3. If the module needs a schema change, stop and propose the smallest compatible change first (see migration rules in `database-schema.md`).
4. Admin (write) endpoints need the Auth module. Do not ship admin endpoints without real authentication + permission checks.

## 1. Folder pattern

```
src/modules/<name>/
├── <name>.module.ts
├── <name>.controller.ts            # public, read-only, published content only
├── <name>-admin.controller.ts      # admin management (session auth + permission)
├── <name>.service.ts               # business logic + Prisma access
├── dto/
│   ├── create-<name>.dto.ts
│   ├── update-<name>.dto.ts
│   ├── list-<name>-query.dto.ts    # extends PaginationQueryDto
│   └── <name>-response.dto.ts      # what the API returns (explicit; never return raw Prisma rows)
├── <name>.service.spec.ts          # unit tests (PrismaService mocked)
└── test/<name>.e2e-spec.ts         # in /test, database mocked or opt-in real DB
```

Register the module in `AppModule.imports`. Do not touch other modules.

## 2. Layers

- **Controller:** HTTP only. Parse/validate input via DTOs, call the service, return the result. No Prisma, no business rules.
- **Service:** business rules, Prisma queries (inject `PrismaService`), throws Nest exceptions (`NotFoundException`, `ConflictException`, ...).
  Prisma unique/FK/not-found errors are already translated by the global filter, but prefer explicit checks for friendly messages.
- **DTOs:** `class-validator` decorators on every field, `@ApiProperty`/`@ApiPropertyOptional` for Swagger. The global pipe rejects unknown properties.
  Strings: set `@MaxLength`. Ids: `@IsUUID()`. JSON `i18n`/`blocks` fields: validate with a Zod schema inside the service before saving (add `zod` when the first module needs it).
- **Response DTOs / mappers:** select only the fields the caller may see. Public responses never include `deletedAt`, internal notes, `evidenceNote`, hashes, `ipHash`, emails of staff, etc.

## 3. Public vs administrative endpoints

|         | Public                                                                                                           | Admin                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Path    | `GET /api/v1/<resource>`                                                                                         | `/api/v1/admin/<resource>`                      |
| Auth    | none                                                                                                             | session + permission key (e.g. `product:write`) |
| Data    | only `status = PUBLISHED` (and `publishedAt <= now`), requested locale, with fallback rule documented per module | everything incl. drafts                         |
| Methods | GET only (plus `POST` for public forms, with strict throttling + honeypot)                                       | full CRUD, publish/unpublish                    |
| Caching | cacheable                                                                                                        | never cached                                    |

**Trust rule:** `Client`, `Testimonial`, `TrustBadge`, `CaseStudy` are returned publicly only when `isVerified = true`, `showOnSite = true` (where present) and `evidenceNote` is filled. Check it in the service query, not in the controller.

**Locale:** public reads take a `locale` (`en`/`bn`) that must exist in `Language` and be enabled. Missing translation => documented fallback to the default language, never an error page for visitors.

## Pages API

The page module is registered in `AppModule` and uses the existing `Page` / `PageTranslation` models. Its paths are:

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/v1/pages?path=/about&locale=en` | Public | Return a published or due-scheduled page translation |
| GET | `/api/v1/admin/pages` | `page:read` | Paginated page list, including translation status |
| GET | `/api/v1/admin/pages/:id` | `page:read` | Page with all translations |
| POST | `/api/v1/admin/pages` | `page:write` | Create a page and its initial translations |
| PATCH | `/api/v1/admin/pages/:id` | `page:write` | Update page properties or upsert translations by locale |
| DELETE | `/api/v1/admin/pages/:id` | `page:delete` | Delete a non-system page without children or policy references |

Publishing or editing an already-published translation also requires `page:publish`. Public lookup requires an enabled
locale and falls back to the enabled default locale for the same path. Draft, review, and archived translations are not
public. Scheduled translations become publicly available when their `scheduledAt` time is reached; their stored status
is not automatically changed to `PUBLISHED`.

Page paths must be local absolute paths without query strings, fragments, or ambiguous encoded separators. Blocks must
use the existing allow-listed block types and contain unique IDs plus JSON-object `data`; unknown block-envelope
properties are rejected. Type-specific data-field schemas and HTML sanitization rules are not defined by the available requirements.
The API validates JSON safety but does not replace context-appropriate escaping by the frontend renderer.

## Navigation API

Navigation administration uses the existing `NavMenu` / `NavItem` models. Every route requires a session with
`nav:write`, the permission already included by the system seed:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/admin/navigation/menus` | List menus and item counts |
| GET | `/api/v1/admin/navigation/menus/:key` | Get menu items as a nested tree |
| POST | `/api/v1/admin/navigation/menus` | Create a menu using an immutable-format lowercase kebab-case key |
| PATCH | `/api/v1/admin/navigation/menus/:key` | Rename a custom menu; seeded keys cannot be renamed |
| POST | `/api/v1/admin/navigation/menus/:key/items` | Create an item |
| PATCH | `/api/v1/admin/navigation/menus/:key/items/:itemId` | Update an item |
| PATCH | `/api/v1/admin/navigation/menus/:key/items/reorder` | Set sort orders for menu item IDs |
| DELETE | `/api/v1/admin/navigation/menus/:key/items/:itemId` | Delete a childless item |

Labels, descriptions, and badges are locale-keyed text objects, and every locale must be enabled. Each item must specify
exactly one target: `href`, `pageId`, `productId`, or `serviceId`. Internal IDs must reference existing records.
`href` accepts a local absolute path or absolute HTTP(S) URL; unsafe schemes, credentials in URLs, ambiguous local
paths, and encoded path separators are rejected. Parent items must belong to the same menu; self-parenting and cycles
are rejected. Deleting a parent with children is refused, and reorder requests are atomic and cannot include IDs from
another menu. The seeded `header`, `footer-company`, and `footer-legal` menu keys are preserved.

## 4. Collections

Use `PaginationQueryDto` (page, pageSize<=100, sortOrder) and return `Paginated<T>`:

```ts
const [items, total] = await this.prisma.$transaction([
  this.prisma.product.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    ...toSkipTake(q.page, q.pageSize),
  }),
  this.prisma.product.count({ where }),
]);
return toPaginated(items.map(toResponse), total, q.page, q.pageSize);
```

Whitelist sortable fields; never pass a client string to `orderBy`.

## 5. Swagger

Every controller: `@ApiTags('<name>')`; every route: `@ApiOkResponse({ type: ... })` / `@ApiCreatedResponse`, plus error responses (`@ApiNotFoundResponse`...).
Admin routes get `@ApiCookieAuth()`. Only implemented endpoints may appear in Swagger.

## 6. Authorization

Authentication uses opaque, server-side sessions in an HttpOnly cookie. Use `@Public()` only for intentionally anonymous
routes and `@Permissions('product:write')` for protected routes. The global session and permission guards fail closed:
every non-public route must explicitly declare `@Permissions(...)` or `@AnyAuthenticated()`. Do not use JWT or role-name
checks in controllers. State-changing cookie-authenticated requests require an allow-listed `Origin` (or `Referer`) as
CSRF protection; browser origins must be explicitly configured in both `CORS_ORIGINS` and `AUTH_ALLOWED_ORIGINS`.
User/role administration and selected resource mutations write `AuditLog` records. Current audit coverage is not
uniform across content modules, and the `Revision` model is not yet written by content APIs; do not assume publish,
delete, or edit actions always produce either record.

### Core admin API

All routes below are under `/api/v1/admin` and, except invitation acceptance, require the session cookie.

| Method            | Path                         | Permission                               | Purpose                                                               |
| ----------------- | ---------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| GET               | `/me`                        | authenticated session                    | Current safe user profile                                             |
| GET               | `/dashboard`                 | `content:read`, `lead:read`, `user:read` | Aggregated dashboard counts                                           |
| GET               | `/users`                     | `user:read`                              | Paginated, filterable user list                                       |
| GET               | `/users/:id`                 | `user:read`                              | Safe user details                                                     |
| PATCH             | `/users/:id`                 | `user:write`                             | Update name or UI locale                                              |
| PATCH             | `/users/:id/status`          | `user:write`                             | Activate/deactivate; deactivation revokes sessions                    |
| POST              | `/users/:id/revoke-sessions` | `user:write`                             | Revoke all of another user's active sessions                          |
| PATCH             | `/users/:id/role`            | `user:write`, `role:write`               | Change role without self-escalation                                   |
| DELETE            | `/users/:id`                 | `user:delete`                            | Soft-delete and revoke sessions                                       |
| POST              | `/users/invites`             | `user:invite`                            | Create a time-limited invite; returns its raw token once for delivery |
| GET               | `/users/invites`             | `user:read`                              | List pending, accepted, or expired invites                            |
| DELETE            | `/users/invites/:id`         | `user:invite`                            | Revoke an unaccepted invite                                           |
| POST              | `/users/invites/accept`      | public, throttled                        | Accept a one-time token and set a password                            |
| GET               | `/roles`, `/permissions`     | `user:read`                              | List roles, grants, and available permission keys                     |
| POST/PATCH/DELETE | `/roles[/:id]`               | `role:write`                             | Manage roles and permission grants                                    |
| GET               | `/audit-logs`                | `audit:read`                             | Paginated, filterable audit history                                   |

Only the `owner` can grant permissions outside their own permission set or manage the owner role. System roles cannot be
deleted; roles with assigned users or invitations cannot be deleted; the last active owner cannot be disabled, demoted,
or removed. User responses never include password hashes, session tokens, or invitation token hashes. Invitation
plaintext is returned only by creation and is stored only as a hash.

### Resource admin APIs

The following existing resource modules also expose session-protected management routes under `/api/v1/admin`:

| Resource path    | Resource                                          |
| ---------------- | ------------------------------------------------- |
| `/blog`          | Posts and localized translations                  |
| `/products`      | Products and localized translations               |
| `/faqs`          | FAQs                                              |
| `/testimonials`  | Trust-rule-aware testimonials                     |
| `/company`       | Company profile                                   |
| `/leads`         | Contact/demo/project inquiries                    |
| `/media`         | Provider-neutral media metadata and safe deletion |
| `/projects`      | Case studies and localized translations           |
| `/services`      | Services and localized translations               |
| `/site-settings` | Site settings                                     |
| `/team`          | Team members and localized translations           |

Controllers use resource-specific permissions where available and `content:*` / `settings:write` for the remaining
resources. Public reads remain separate from admin access. Audit writes currently exist for Company, Leads, Media,
Projects, Services, Site Settings, and Team; Blog, Products, FAQs, and Testimonials writes do not currently create
audit records. Media management registers metadata for an external storage provider; this API does not upload bytes or
configure a storage provider.

### Inventory gaps and limits

This is an inventory of currently registered code, not a complete product scope. `AppModule` currently wires no admin
controllers for schema-backed pages/reusable blocks, themes, navigation, job postings, subscribers, offices, redirects,
announcements, form definitions, pricing plans, industries, technologies, clients, or trust badges. Whether these
domains require admin CRUD has not been specified, so no endpoints are inferred here. The models and some public
surface requirements do not by themselves define the required write workflows or permission granularity.

The lead and media APIs use global permission checks; there is no tenant-specific record-ownership policy in the
current schema. Lead assignment is constrained by the database foreign key. Media uploader identity is taken from the
authenticated session, and deletion is blocked while the asset is referenced.

Audit coverage is not uniform: user/role administration, company, lead deletion, media, projects, services, site
settings, and team mutations contain audit writes; Blog, Products, FAQs, and Testimonials do not currently write
`AuditLog` entries. No resource write is claimed to create a `Revision`.

## 7. Tests (required)

- **Unit** (`*.spec.ts`): service logic with `PrismaService` mocked (`{ product: { findMany: jest.fn() } } as unknown as PrismaService`).
- **E2E** (`test/*.e2e-spec.ts`): build the app with shared helpers and a mocked `PrismaService`; retain success, validation error (400), not found (404), unauthorized (401), forbidden (403), published-only visibility, and trust-rule assertions. The configured runner only discovers specs under `test/`; resource E2E files under `src/modules/**/test` are not part of that runner and may reference unavailable helpers.
- **Real-database tests** are not part of the baseline (no database is assumed). When needed, add an opt-in suite that runs only if `TEST_DATABASE_URL` is set, against a throw-away database, never a shared or production one.

## 8. Definition of done

- [ ] Uses the real Prisma models; no schema change without approval; migration (if any) reviewed.
- [ ] DTOs validated, whitelist behaviour tested; responses are explicit DTOs.
- [ ] Public/admin split respected; trust rule and published-only filtering tested.
- [ ] Admin routes protected by real auth + permission (or not exposed yet).
- [ ] Swagger documents every endpoint.
- [ ] Unit + e2e tests added and passing; `npm run typecheck`, `lint`, `format:check`, `test`, `test:e2e`, `build` all pass.
- [ ] `docs/implementation-status.md` updated with exactly what exists.
- [ ] No `any` without a comment, no secrets, no fake business data.
