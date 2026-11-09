import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/** Published-content resources that are identical for every anonymous visitor. */
const CACHEABLE_PREFIXES = [
  '/api/v1/services',
  '/api/v1/products',
  '/api/v1/projects',
  '/api/v1/blog',
  '/api/v1/team',
  '/api/v1/testimonials',
  '/api/v1/faqs',
  '/api/v1/company',
  '/api/v1/navigation',
  '/api/v1/site-settings',
  '/api/v1/careers',
  '/api/v1/pages',
];

export const PUBLIC_CACHE_CONTROL = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

/**
 * Lets a CDN / reverse proxy serve published content for a minute and revalidate in the background,
 * which removes most database hits for anonymous traffic.
 *
 * Applied only when ALL of these hold, so nothing private or draft is ever shared:
 *  - the handler (or its controller) is marked `@Public()`
 *  - the request is a GET for a published-content prefix
 *  - there is no Authorization header or cookie, and no `preview` query parameter
 */
@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const path = (req.originalUrl || req.url || '').split('?')[0];
    const cacheable =
      isPublic &&
      req.method === 'GET' &&
      CACHEABLE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) &&
      !req.headers?.authorization &&
      !req.headers?.cookie &&
      req.query?.preview === undefined;

    if (!cacheable) return next.handle();

    return next.handle().pipe(
      tap(() => {
        if (!res.headersSent && res.statusCode === 200) {
          res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
          res.setHeader('Vary', 'Accept-Encoding, Origin');
        }
      }),
    );
  }
}
