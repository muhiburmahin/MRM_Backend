import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { PUBLIC_CACHE_CONTROL, PublicCacheInterceptor } from './public-cache.interceptor';

interface FakeRequest {
  method: string;
  originalUrl: string;
  headers: Record<string, string>;
  query: Record<string, unknown>;
}

function run(opts: { isPublic?: boolean; req?: Partial<FakeRequest>; status?: number }) {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: opts.status ?? 200,
    headersSent: false,
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
  };
  const req: FakeRequest = {
    method: 'GET',
    originalUrl: '/api/v1/services',
    headers: {},
    query: {},
    ...opts.req,
  };
  const reflector = { getAllAndOverride: () => opts.isPublic ?? true } as unknown as Reflector;
  const context = {
    getType: () => 'http',
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of('body') };
  return lastValueFrom(new PublicCacheInterceptor(reflector).intercept(context, next)).then(() => headers);
}

describe('PublicCacheInterceptor', () => {
  it('caches anonymous public GETs for published content', async () => {
    expect((await run({}))['Cache-Control']).toBe(PUBLIC_CACHE_CONTROL);
    expect((await run({ req: { originalUrl: '/api/v1/projects/edumanage?locale=en' } }))['Cache-Control']).toBe(
      PUBLIC_CACHE_CONTROL,
    );
  });

  it.each([
    ['non-public handlers', { isPublic: false }],
    ['non-GET requests', { req: { method: 'POST' } }],
    ['admin routes', { req: { originalUrl: '/api/v1/admin/services' } }],
    ['auth routes', { req: { originalUrl: '/api/v1/auth/me' } }],
    ['health checks', { req: { originalUrl: '/api/v1/health' } }],
    ['prefix look-alikes', { req: { originalUrl: '/api/v1/servicesx' } }],
    ['requests carrying an Authorization header', { req: { headers: { authorization: 'Bearer x' } } }],
    ['requests carrying cookies', { req: { headers: { cookie: 'mrm_session=abc' } } }],
    ['draft previews', { req: { query: { preview: 'true' } } }],
    ['error responses', { status: 404 }],
  ])('does not cache %s', async (_label, opts) => {
    expect((await run(opts as Parameters<typeof run>[0]))['Cache-Control']).toBeUndefined();
  });
});
