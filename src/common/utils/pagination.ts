import { Paginated } from '../types/paginated';

/** Converts page/pageSize into Prisma `skip` / `take`. */
export function toSkipTake(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function toPaginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return { items, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}
