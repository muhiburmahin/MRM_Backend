import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { AppConfigService } from '../src/config/app-config.service';
import { PrismaService } from '../src/database/prisma.service';

describe('Foundation (e2e, database mocked)', () => {
  let app: NestExpressApplication;
  const prismaMock = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app, app.get(AppConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => prismaMock.$queryRaw.mockReset());

  it('GET /api/v1/health -> 200 liveness without touching the database', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('GET /api/v1/health/ready -> 200 when the database answers', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    expect(res.body).toEqual({ status: 'ok', checks: { database: 'up' } });
  });

  it('GET /api/v1/health/ready -> 503 with a safe body when the database fails', async () => {
    prismaMock.$queryRaw.mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.5:5432 password=secret'),
    );
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);
    expect(res.body).toMatchObject({
      statusCode: 503,
      message: 'Service temporarily unavailable.',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|password|10\.0\.0\.5/);
  });

  it('unknown route -> consistent 404 error shape and a request id', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found', path: '/api/v1/nope' });
    expect(res.body.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('un-versioned path is not served', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(404);
  });

  it('sends secure headers and hides X-Powered-By', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('CORS: allows a listed origin and refuses an unlisted one', async () => {
    const ok = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://allowed.example');
    expect(ok.headers['access-control-allow-origin']).toBe('http://allowed.example');
    const bad = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('ignores an unsafe inbound X-Request-Id', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', 'bad id with spaces & symbols!');
    expect(res.headers['x-request-id']).toMatch(/^[\w-]{8,64}$/);
  });
});
