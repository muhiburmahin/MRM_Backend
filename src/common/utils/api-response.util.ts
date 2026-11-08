export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta: PaginationMeta | Record<string, unknown> | null;
}

const SENSITIVE_KEYS = new Set(['passwordHash', 'twoFactorSecretEnc', 'tokenHash', 'codeHash']);

export function stripSensitiveFields<T>(input: T): T {
  if (input === null || input === undefined || typeof input !== 'object') {
    return input;
  }
  if (input instanceof Date) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => stripSensitiveFields(item)) as unknown as T;
  }
  const cloned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    cloned[key] = stripSensitiveFields(value);
  }
  return cloned as T;
}

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const safeLimit = Math.max(1, limit);
  const safePage = Math.max(1, page);
  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  };
}

export function wrapSuccessResponse<T>(
  data: T,
  message = 'Operation successful',
  meta: PaginationMeta | Record<string, unknown> | null = null,
  statusCode = 200,
): ApiSuccessEnvelope<T> {
  return {
    success: true,
    statusCode,
    message,
    data: stripSensitiveFields(data),
    meta,
  };
}
