export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const LOCALE_RE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

export const PUBLIC_SORT_FIELDS = ['order', 'sortOrder', 'name', 'createdAt'] as const;
export const ADMIN_SORT_FIELDS = [
  'order',
  'sortOrder',
  'slug',
  'joinedAt',
  'createdAt',
  'updatedAt',
] as const;
export type SortOrder = 'asc' | 'desc';

/** Only these social networks are accepted/returned (https URLs only). */
export const SOCIAL_KEYS = [
  'linkedin',
  'github',
  'x',
  'facebook',
  'instagram',
  'youtube',
  'behance',
  'dribbble',
  'website',
] as const;

/** Must exist in the seeded Permission table (see README note in the final message). */
export const TEAM_PERMISSIONS = {
  read: 'content:read',
  write: 'content:write',
  publish: 'content:publish',
  delete: 'content:delete',
} as const;
