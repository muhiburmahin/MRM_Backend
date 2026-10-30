/** Slugs are ASCII on purpose (stable URLs); Bangla titles live in the translation `name`. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const LOCALE_RE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

/** ServiceTranslation has no `scheduledAt` column, so SCHEDULED is intentionally NOT accepted. */
export const WRITABLE_STATUSES = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;
export type WritableStatus = (typeof WRITABLE_STATUSES)[number];

export const PUBLIC_SORT_FIELDS = ['sortOrder', 'name', 'publishedAt'] as const;
export const ADMIN_SORT_FIELDS = ['sortOrder', 'slug', 'createdAt', 'updatedAt'] as const;
export type SortOrder = 'asc' | 'desc';

/** Permission keys — must exist in the seeded Permission table (see docs/services-api.md). */
export const SERVICE_PERMISSIONS = {
  read: 'service:read',
  write: 'service:write',
  publish: 'service:publish',
  delete: 'service:delete',
} as const;
