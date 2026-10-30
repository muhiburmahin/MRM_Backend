import '../../../../test/setup-env';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../../../../test/helpers/create-app';
import { ADMIN, USER } from '../../../../test/helpers/test-guards';
import { FakePrisma } from '../../../../test/helpers/fake-prisma';

describe('Pages API (e2e)', () => {
  let app: INestApplication;
  let db: FakePrisma;
  const http = () => request(app.getHttpServer());
  const make = (status = 'DRAFT', over: Record<string, unknown> = {}) => ({
    key: 'about',
    translations: [
      {
        locale: 'en',
        path: '/about',
        title: 'About us',
        blocks: [{ id: 'hero-main', type: 'hero', data: { heading: 'About us' } }],
        status,
        ...over,
      },
    ],
  });

  beforeAll(async () => ({ app, db } = await createTestApp()));
  afterAll(() => app.close());
  beforeEach(() => {
    db.pages.length = 0;
  });

  it('protects administrative routes with authentication and page permissions', async () => {
    await http().get('/api/v1/admin/pages').expect(401);
    await http().get('/api/v1/admin/pages').set(USER).expect(403);
    await http().post('/api/v1/admin/pages').set(USER).send(make()).expect(403);
  });

  it('creates a draft, publishes it with permission, and serves only the published page', async () => {
    const created = await http().post('/api/v1/admin/pages').set(ADMIN).send(make()).expect(201);
    expect(created.body.key).toBe('about');
    expect(created.body.translations[0]).toMatchObject({
      locale: 'en',
      path: '/about',
      status: 'DRAFT',
    });
    await http().get('/api/v1/pages?path=%2Fabout&locale=en').expect(404);

    const published = await http()
      .patch(`/api/v1/admin/pages/${created.body.id}`)
      .set(ADMIN)
      .send({
        translations: [
          {
            locale: 'en',
            path: '/about',
            title: 'About MRM',
            blocks: [{ id: 'hero-main', type: 'hero', data: { heading: 'About MRM' } }],
            status: 'PUBLISHED',
          },
        ],
      })
      .expect(200);
    expect(published.body.translations[0].publishedAt).toBeTruthy();

    const page = await http().get('/api/v1/pages?path=%2Fabout&locale=en').expect(200);
    expect(page.body).toMatchObject({
      key: 'about',
      locale: 'en',
      title: 'About MRM',
      blocks: [{ id: 'hero-main', type: 'hero', data: { heading: 'About MRM' } }],
      availableLocales: ['en'],
    });
    expect(page.body).not.toHaveProperty('status');
  });

  it('rejects invalid page paths, unsupported blocks, and attempts to set system fields', async () => {
    await http()
      .post('/api/v1/admin/pages')
      .set(ADMIN)
      .send(make('DRAFT', { path: '//external.example' }))
      .expect(400);
    await http()
      .post('/api/v1/admin/pages')
      .set(ADMIN)
      .send(
        make('DRAFT', {
          blocks: [{ id: 'bad', type: 'script', data: { src: 'https://example.test/x.js' } }],
        }),
      )
      .expect(400);
    await http()
      .post('/api/v1/admin/pages')
      .set(ADMIN)
      .send({ ...make(), isSystem: true })
      .expect(400);
  });

  it('rejects invalid locales and refuses to delete a system page', async () => {
    await http().get('/api/v1/pages?path=%2Fmissing&locale=xx').expect(400);
    db.pages.push({
      id: '00000000-0000-4000-8000-000000000001',
      key: 'home',
      isSystem: true,
      translations: [],
    });
    await http()
      .delete('/api/v1/admin/pages/00000000-0000-4000-8000-000000000001')
      .set(ADMIN)
      .expect(409);
  });
});
