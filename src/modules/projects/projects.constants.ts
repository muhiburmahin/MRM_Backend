export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const LOCALE_RE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

export const WRITABLE_STATUSES = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;
export type WritableStatus = (typeof WRITABLE_STATUSES)[number];

export const PUBLIC_SORT_FIELDS = ['sortOrder', 'publishedAt', 'title'] as const;
export const ADMIN_SORT_FIELDS = ['sortOrder', 'slug', 'publishedAt'] as const;
export type SortOrder = 'asc' | 'desc';

export const EVIDENCE_NOTE_MIN = 10;
export const MAX_METRICS = 10;

/** Must exist in the seeded Permission table. */
export const PROJECT_PERMISSIONS = {
  read: 'casestudy:read',
  write: 'casestudy:write',
  publish: 'casestudy:publish',
  delete: 'casestudy:delete',
} as const;
