import { createHash, randomBytes } from 'crypto';

/** 256-bit opaque token, URL-safe. Only its SHA-256 hash is stored in the DB. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Salted hash so raw IP addresses are never stored. */
export function hashIp(ip: string | undefined, salt: string): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
