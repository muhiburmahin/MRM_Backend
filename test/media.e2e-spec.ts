import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-app';
import { ADMIN, USER } from './helpers/test-guards';
import { FakePrisma } from './helpers/fake-prisma';

describe('Admin media metadata API (e2e)', () => {
  let app: INestApplication;
  let db: FakePrisma;

  const media = () => request(app.getHttpServer());
  const metadata = {
    kind: 'IMAGE',
    storageKey: 'public/site/logo.png',
    url: 'https://cdn.example.com/logo.png',
    fileName: 'logo.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    alt: { en: 'Company logo' },
  };

  beforeAll(async () => ({ app, db } = await createTestApp()));
  afterAll(async () => app.close());
  beforeEach(() => {
    db.media.rows.length = 0;
  });

  it('requires authentication and the media upload permission', async () => {
    await media().post('/api/v1/admin/media').send(metadata).expect(401);
    await media().post('/api/v1/admin/media').set(USER).send(metadata).expect(403);
    await media().get('/api/v1/admin/media').expect(401);
    await media()
      .post('/api/v1/admin/media')
      .set({ ...ADMIN, Origin: 'https://untrusted.example' })
      .send(metadata)
      .expect(403);
  });

  it('registers validated provider-neutral metadata and returns no uploader identity', async () => {
    const response = await media()
      .post('/api/v1/admin/media')
      .set(ADMIN)
      .send(metadata)
      .expect(201);

    expect(response.body).toMatchObject({
      storageKey: 'public/site/logo.png',
      url: metadata.url,
      mimeType: 'image/png',
      sizeBytes: 1024,
      alt: { en: 'Company logo' },
    });
    expect(response.body).not.toHaveProperty('uploadedById');
    expect(db.media.rows[0].uploadedById).toBe('test-admin-id');
  });

  it.each([
    ['image without alt text', { ...metadata, alt: undefined }],
    ['provider path traversal', { ...metadata, storageKey: '../outside/logo.png' }],
    ['invalid URL', { ...metadata, url: 'javascript:alert(1)' }],
    ['zero size', { ...metadata, sizeBytes: 0 }],
    ['client-supplied uploader', { ...metadata, uploadedById: 'attacker' }],
  ])('rejects %s with 400', async (_label, body) => {
    await media().post('/api/v1/admin/media').set(ADMIN).send(body).expect(400);
    expect(db.media.rows).toHaveLength(0);
  });

  it('lists, fetches, and validates media metadata routes', async () => {
    const created = await media().post('/api/v1/admin/media').set(ADMIN).send(metadata).expect(201);

    const list = await media()
      .get('/api/v1/admin/media')
      .query({ limit: 10 })
      .set(ADMIN)
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta).toMatchObject({ page: 1, limit: 10, total: 1 });

    await media().get(`/api/v1/admin/media/${created.body.id}`).set(ADMIN).expect(200);
    await media().get('/api/v1/admin/media/not-a-uuid').set(ADMIN).expect(400);
    await media()
      .get('/api/v1/admin/media/00000000-0000-4000-8000-000000000000')
      .set(ADMIN)
      .expect(404);
    await media().get('/api/v1/admin/media').query({ limit: 1000 }).set(ADMIN).expect(400);
  });

  it('requires delete permission and removes a media metadata record', async () => {
    const created = await media().post('/api/v1/admin/media').set(ADMIN).send(metadata).expect(201);

    await media().delete(`/api/v1/admin/media/${created.body.id}`).set(USER).expect(403);
    await media().delete(`/api/v1/admin/media/${created.body.id}`).set(ADMIN).expect(204);
    expect(db.media.rows).toHaveLength(0);
    await media().delete(`/api/v1/admin/media/${created.body.id}`).set(ADMIN).expect(404);
  });
});
