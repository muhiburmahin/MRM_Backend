import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const SAFE_REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

export function resolveSafeRequestId(incomingHeader?: string | string[]): string {
  const candidate = Array.isArray(incomingHeader) ? incomingHeader[0] : incomingHeader;
  if (candidate && SAFE_REQUEST_ID_PATTERN.test(candidate.trim())) {
    return candidate.trim();
  }
  return `req_${randomUUID().replace(/-/g, '')}`;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction): void {
    const requestId = resolveSafeRequestId(req.headers['x-request-id']);
    req.id = requestId;
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}

