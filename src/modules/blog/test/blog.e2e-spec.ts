import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from '../../../../test/helpers/create-app';
import { ADMIN, USER } from '../../../../test/helpers/test-guards';
import { FakePrisma } from '../../../../test/helpers/fake-prisma';

describe('Blog API (e2e)', () => {
  let app: INestApplication;
  let db: FakePrisma;
  const http = () => request(app.getHttpServer());
  const rows = () => db.post.rows;
  const MISSING = '00000000-0000-4000-8000-000000000000';

  const translation = (over: Record<string, unknown> = {}) => ({
    locale: 'en',
    slug: 'first-post',
    title: 'First Post',
    excerpt: 'Intro',
    body: 'Hello world',
    ...over,
  });
  const make = (over: Record<string, unknown> = {}) => ({
    translations: [translation()],
    ...over,
  });
  const seed = async () => {
    await http()
      .post('/api/v1/admin/blog')
      .set(ADMIN)
      .send(make({ translations: [translation({ status: 'PUBLISHED' })] }))
      .expect(201);
    await http()
      .post('/api/v1/admin/blog')
      .set(ADMIN)
      .send(make({ translations: [translation({ slug: 'secret-draft', title: 'Secret Draft' })] }))
      .expect(201);
    await http()
      .post('/api/v1/admin/blog')
      .set(ADMIN)
      .send(
        make({
          translations: [
            translation({ slug: 'second-post', title: 'Second Post', status: 'PUBLISHED' }),
          ],
        }),
      )
      .expect(201);
  };

  beforeAll(async () => ({ app, db } = await createTestApp()));
  afterAll(() => app.close());
  beforeEach(() => {
    rows().length = 0;
    db.postTranslations.length = 0;
    jest.restoreAllMocks();
  });

  describe('public', () => {
    it('lists only published posts and excludes body and author identity', async () => {
      await seed();
      const response = await http().get('/api/v1/blog?limit=10').expect(200);
      expect(response.body.data.map((post: { slug: string }) => post.slug).sort()).toEqual([
        'first-post',
        'second-post',
      ]);
      expect(response.body.meta).toMatchObject({ page: 1, limit: 10, total: 2 });
      for (const post of response.body.data) {
        expect(post).not.toHaveProperty('body');
        expect(post).not.toHaveProperty('authorId');
      }
    });

    it('rejects draft-visibility tricks and invalid queries', async () => {
      await http().get('/api/v1/blog?isPublished=false').expect(400);
      await http().get('/api/v1/blog?sortBy=authorId').expect(400);
      await http().get('/api/v1/blog?limit=500').expect(400);
      await http().get('/api/v1/blog?page=0').expect(400);
    });

    it('searches by title', async () => {
      await seed();
      const response = await http().get('/api/v1/blog?search=second').expect(200);
      expect(response.body.data.map((post: { slug: string }) => post.slug)).toEqual([
        'second-post',
      ]);
    });

    it('returns full content for a published post and hides drafts and unknown slugs', async () => {
      await seed();
      const response = await http().get('/api/v1/blog/first-post').expect(200);
      expect(response.body.body).toBe('Hello world');
      await http().get('/api/v1/blog/secret-draft').expect(404);
      await http().get('/api/v1/blog/unknown').expect(404);
    });
  });

  describe('admin', () => {
    it('rejects unauthenticated and non-admin callers', async () => {
      await http().get('/api/v1/admin/blog').expect(401);
      await http().post('/api/v1/admin/blog').send(make()).expect(401);
      await http().post('/api/v1/admin/blog').set(USER).send(make()).expect(403);
      await http().delete(`/api/v1/admin/blog/${MISSING}`).set(USER).expect(403);
    });

    it('creates a draft with server-controlled author identity', async () => {
      const response = await http().post('/api/v1/admin/blog').set(ADMIN).send(make()).expect(201);
      expect(response.body.authorId).toBe('test-admin-id');
      expect(response.body.translations[0]).toMatchObject({
        slug: 'first-post',
        status: 'DRAFT',
        publishedAt: null,
      });
    });

    it.each([
      ['missing translations', { translations: [] }],
      ['invalid slug', { translations: [translation({ slug: 'Bad Slug!' })] }],
      ['client-supplied authorId', { authorId: 'someone-else' }],
      ['client-supplied publishedAt', { publishedAt: '2020-01-01' }],
      ['client-supplied id', { id: 'abc' }],
    ])('rejects create with %s', async (_label, body) => {
      await http().post('/api/v1/admin/blog').set(ADMIN).send(body).expect(400);
      expect(rows()).toHaveLength(0);
    });

    it('requires the publish permission for published translations', async () => {
      await http()
        .post('/api/v1/admin/blog')
        .set(USER)
        .send(make({ translations: [translation({ status: 'PUBLISHED' })] }))
        .expect(403);
      expect(rows()).toHaveLength(0);
    });

    it('maps a unique translation violation to 409', async () => {
      jest
        .spyOn(db.post, 'create')
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
        );
      await http().post('/api/v1/admin/blog').set(ADMIN).send(make()).expect(409);
    });

    it('updates translations, then deletes the post', async () => {
      const created = await http().post('/api/v1/admin/blog').set(ADMIN).send(make()).expect(201);
      const id = created.body.id as string;
      await http()
        .patch(`/api/v1/admin/blog/${id}`)
        .set(ADMIN)
        .send({ translations: [translation({ title: 'Renamed Post' })] })
        .expect(200);
      expect(rows()[0].translations).toEqual(
        expect.arrayContaining([expect.objectContaining({ title: 'Renamed Post' })]),
      );
      await http().get(`/api/v1/admin/blog/${id}`).set(ADMIN).expect(200);
      await http().delete(`/api/v1/admin/blog/${id}`).set(ADMIN).expect(200);
      await http().delete(`/api/v1/admin/blog/${id}`).set(ADMIN).expect(404);
    });

    it('returns 400 for malformed IDs and 404 for missing posts', async () => {
      await http().get('/api/v1/admin/blog/not-a-uuid').set(ADMIN).expect(400);
      await http().get(`/api/v1/admin/blog/${MISSING}`).set(ADMIN).expect(404);
    });
  });
});
