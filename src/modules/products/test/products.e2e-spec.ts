import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from '../../../../test/helpers/create-app';
import { ADMIN, USER } from '../../../../test/helpers/test-guards';
import { FakePrisma } from '../../../../test/helpers/fake-prisma';

describe('Products API (e2e)', () => {
  let app: INestApplication;
  let db: FakePrisma;
  const http = () => request(app.getHttpServer());
  const rows = () => db.product.rows;
  const MISSING = '00000000-0000-4000-8000-000000000000';

  const translation = (over: Record<string, unknown> = {}) => ({
    locale: 'en',
    name: 'Website Package',
    tagline: 'A business website',
    summary: 'A complete website package.',
    body: { details: 'Package details' },
    ...over,
  });
  const make = (over: Record<string, unknown> = {}) => ({
    slug: 'website-package',
    translations: [translation()],
    ...over,
  });
  const seed = async () => {
    await http()
      .post('/api/v1/admin/products')
      .set(ADMIN)
      .send(
        make({
          sortOrder: 2,
          translations: [translation({ status: 'PUBLISHED' })],
        }),
      )
      .expect(201);
    await http()
      .post('/api/v1/admin/products')
      .set(ADMIN)
      .send(
        make({
          slug: 'hidden-draft',
          translations: [translation({ name: 'Hidden Draft' })],
        }),
      )
      .expect(201);
    await http()
      .post('/api/v1/admin/products')
      .set(ADMIN)
      .send(
        make({
          slug: 'mobile-app',
          sortOrder: 1,
          translations: [translation({ name: 'Mobile App', status: 'PUBLISHED' })],
        }),
      )
      .expect(201);
  };

  beforeAll(async () => ({ app, db } = await createTestApp()));
  afterAll(() => app.close());
  beforeEach(() => {
    rows().length = 0;
    db.productTranslations.length = 0;
    jest.restoreAllMocks();
  });

  describe('public', () => {
    it('lists only published products with pagination and no internal translation fields', async () => {
      await seed();
      const response = await http().get('/api/v1/products?limit=10').expect(200);
      expect(response.body.data.map((product: { slug: string }) => product.slug).sort()).toEqual([
        'mobile-app',
        'website-package',
      ]);
      expect(response.body.meta).toMatchObject({ page: 1, limit: 10, total: 2 });
      for (const product of response.body.data) {
        expect(product).not.toHaveProperty('status');
        expect(product).not.toHaveProperty('authorId');
      }
    });

    it('cannot be tricked into showing drafts via query parameters', async () => {
      await seed();
      await http().get('/api/v1/products?isPublished=false').expect(400);
    });

    it('searches and sorts by allowlisted fields only', async () => {
      await seed();
      const search = await http().get('/api/v1/products?search=mobile').expect(200);
      expect(search.body.data.map((product: { slug: string }) => product.slug)).toEqual([
        'mobile-app',
      ]);
      const sorted = await http().get('/api/v1/products?sortBy=sortOrder&order=desc').expect(200);
      expect(sorted.body.data[0].slug).toBe('website-package');
      await http().get('/api/v1/products?sortBy=stage').expect(400);
      await http().get('/api/v1/products?limit=1000').expect(400);
    });

    it('returns a published product by slug and hides drafts and unknown slugs', async () => {
      await seed();
      await http().get('/api/v1/products/website-package').expect(200);
      await http().get('/api/v1/products/hidden-draft').expect(404);
      await http().get('/api/v1/products/nope').expect(404);
    });
  });

  describe('admin', () => {
    it('rejects unauthenticated and non-admin callers', async () => {
      await http().get('/api/v1/admin/products').expect(401);
      await http().post('/api/v1/admin/products').send(make()).expect(401);
      await http().post('/api/v1/admin/products').set(USER).send(make()).expect(403);
      await http()
        .patch(`/api/v1/admin/products/${MISSING}`)
        .set(USER)
        .send({ slug: 'x' })
        .expect(403);
      await http().delete(`/api/v1/admin/products/${MISSING}`).set(USER).expect(403);
    });

    it('creates a draft product by default and lists it for admins', async () => {
      const response = await http()
        .post('/api/v1/admin/products')
        .set(ADMIN)
        .send(make())
        .expect(201);
      expect(response.body).toMatchObject({
        slug: 'website-package',
        stage: 'LIVE',
        translations: [expect.objectContaining({ status: 'DRAFT', publishedAt: null })],
      });
      const drafts = await http()
        .get('/api/v1/admin/products?isPublished=false')
        .set(ADMIN)
        .expect(200);
      expect(drafts.body.data).toHaveLength(1);
    });

    it.each([
      ['missing translations', { translations: [] }],
      ['bad slug', { slug: 'Bad Slug!' }],
      ['negative sort order', { sortOrder: -1 }],
      ['client-supplied ID', { id: 'abc' }],
      ['client-supplied creation date', { createdAt: '2020-01-01' }],
    ])('rejects create with %s', async (_label, body) => {
      await http()
        .post('/api/v1/admin/products')
        .set(ADMIN)
        .send({ ...make(), ...body })
        .expect(400);
      expect(rows()).toHaveLength(0);
    });

    it('maps a unique-slug violation to 409', async () => {
      jest
        .spyOn(db.product, 'create')
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
        );
      await http().post('/api/v1/admin/products').set(ADMIN).send(make()).expect(409);
    });

    it('updates translations and stage, then exposes a live published product', async () => {
      const created = await http()
        .post('/api/v1/admin/products')
        .set(ADMIN)
        .send(make())
        .expect(201);
      const id = created.body.id as string;
      await http()
        .patch(`/api/v1/admin/products/${id}`)
        .set(ADMIN)
        .send({
          translations: [translation({ name: 'Renamed Package', status: 'PUBLISHED' })],
        })
        .expect(200);
      expect(rows()[0].translations).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Renamed Package' })]),
      );
      await http().get('/api/v1/products/website-package').expect(200);
      await http()
        .patch(`/api/v1/admin/products/${id}`)
        .set(ADMIN)
        .send({ id: 'other' })
        .expect(400);
    });

    it('returns 400 for malformed IDs and 404 for missing products', async () => {
      await http().get('/api/v1/admin/products/not-a-uuid').set(ADMIN).expect(400);
      await http().get(`/api/v1/admin/products/${MISSING}`).set(ADMIN).expect(404);
      await http()
        .patch(`/api/v1/admin/products/${MISSING}`)
        .set(ADMIN)
        .send({ slug: 'not-found' })
        .expect(404);
    });

    it('deletes a product and returns not found on a second delete', async () => {
      const created = await http()
        .post('/api/v1/admin/products')
        .set(ADMIN)
        .send(make())
        .expect(201);
      await http().delete(`/api/v1/admin/products/${created.body.id}`).set(ADMIN).expect(200);
      await http().delete(`/api/v1/admin/products/${created.body.id}`).set(ADMIN).expect(404);
    });
  });
});
