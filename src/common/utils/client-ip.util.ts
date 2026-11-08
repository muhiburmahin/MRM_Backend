import type { Request } from 'express';

/**
 * Safely extracts client IP address from Express Request.
 * Uses req.ip which respects Express 'trust proxy' configuration set at application bootstrap.
 */
export function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}
