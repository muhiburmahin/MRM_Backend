import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../../../../test/helpers/create-app';
import { ADMIN, USER } from '../../../../test/helpers/test-guards';
import { FakePrisma } from '../../../../test/helpers/fake-prisma';

describe('FAQs API (e2e)', () => {
  let app: INestApplication;
  let db: FakePrisma;
  const http = () => request(app.getHttpServer());
  const rows = () => db.faq.rows;
  const MISSING = '00000000-0000-4000-8000-000000000000';

  const make = (question = 'How long does it take?', over: Record<string, unknown> = {}) => ({
    i18n: { en: { question, answer: 'About 4 weeks.' } },
    ...over,
  });
  const create = (question?: string, over?: Record<string, unknown>) =>
    http().post('/api/v1/admin/faqs').set(ADMIN).send(make(question, over));
  const seed = async () => {
    await create('Second question?', { isPublished: true, sortOrder: 2 }).expect(201);
    await create('Hidden draft?', { sortOrder: 3 }).expect(201);
    await create('First question?', { isPublished: true, sortOrder: 1 }).expect(201);
  };

  beforeAll(async () => ({ app, db } = await createTestApp()));
  afterAll(() => app.close());
  beforeEach(() => {
    rows().length = 0;
  });

  describe('public', () => {
    it('lists only published FAQs in display order and returns public fields only', async () => {
      await seed();
      const response = await http().get('/api/v1/faqs').expect(200);
      expect(response.body.data.map((faq: { question: string }) => faq.question)).toEqual([
        'First question?',
        'Second question?',
      ]);
      expect(response.body.meta).toMatchObject({ page: 1, limit: 50, total: 2, totalPages: 1 });
      for (const faq of response.body.data) {
        expect(Object.keys(faq).sort()).toEqual(['answer', 'id', 'question']);
      }
    });

    it('supports search and rejects invalid or draft-revealing queries', async () => {
      await seed();
      const response = await http().get('/api/v1/faqs?search=second').expect(200);
      expect(response.body.data.map((faq: { question: string }) => faq.question)).toEqual([
        'Second question?',
      ]);
      await http().get('/api/v1/faqs?isPublished=false').expect(400);
      await http().get('/api/v1/faqs?sortBy=answer').expect(400);
      await http().get('/api/v1/faqs?limit=1000').expect(400);
      await http().get('/api/v1/faqs?order=sideways').expect(400);
    });

    it('returns a published FAQ by ID and hides drafts and unknown IDs', async () => {
      await seed();
      const published = rows().find((row) => row.isPublished === true);
      const draft = rows().find((row) => row.isPublished === false);
      if (!published || !draft) throw new Error('FAQ seed did not create published and draft rows');
      await http().get(`/api/v1/faqs/${published.id}`).expect(200);
      await http().get(`/api/v1/faqs/${draft.id}`).expect(404);
      await http().get(`/api/v1/faqs/${MISSING}`).expect(404);
      await http().get('/api/v1/faqs/not-a-uuid').expect(400);
    });
  });

  describe('admin', () => {
    it('rejects unauthenticated and non-admin callers', async () => {
      await http().get('/api/v1/admin/faqs').expect(401);
      await http().post('/api/v1/admin/faqs').send(make()).expect(401);
      await http().post('/api/v1/admin/faqs').set(USER).send(make()).expect(403);
      await http().delete(`/api/v1/admin/faqs/${MISSING}`).set(USER).expect(403);
    });

    it('creates an unpublished FAQ by default and lists drafts for admins', async () => {
      const response = await create().expect(201);
      expect(response.body).toMatchObject({ isPublished: false, sortOrder: 0 });
      const drafts = await http()
        .get('/api/v1/admin/faqs?isPublished=false')
        .set(ADMIN)
        .expect(200);
      expect(drafts.body.data).toHaveLength(1);
    });

    it.each([
      ['missing translations', { i18n: {} }],
      ['missing answer', { i18n: { en: { question: 'Question?', answer: '' } } }],
      ['client-supplied ID', { id: 'abc' }],
      ['client-supplied creation date', { createdAt: '2020-01-01' }],
    ])('rejects create with %s', async (_label, body) => {
      await http().post('/api/v1/admin/faqs').set(ADMIN).send(body).expect(400);
      expect(rows()).toHaveLength(0);
    });

    it('requires the publish permission and preserves FAQ updates', async () => {
      await http()
        .post('/api/v1/admin/faqs')
        .set(USER)
        .send(make('Published?', { isPublished: true }))
        .expect(403);
      const created = await create().expect(201);
      await http()
        .patch(`/api/v1/admin/faqs/${created.body.id}`)
        .set(ADMIN)
        .send({ i18n: { en: { question: 'Updated?', answer: 'Updated answer.' } } })
        .expect(200);
      expect(rows()[0].i18n).toEqual({ en: { question: 'Updated?', answer: 'Updated answer.' } });
      await http()
        .patch(`/api/v1/admin/faqs/${created.body.id}`)
        .set(ADMIN)
        .send({ isPublished: true })
        .expect(200);
      await http().get(`/api/v1/faqs/${created.body.id}`).expect(200);
      await http()
        .patch(`/api/v1/admin/faqs/${created.body.id}`)
        .set(ADMIN)
        .send({ id: 'other' })
        .expect(400);
    });

    it('returns 400 for malformed IDs and 404 for missing FAQs', async () => {
      await http().get('/api/v1/admin/faqs/not-a-uuid').set(ADMIN).expect(400);
      await http().get(`/api/v1/admin/faqs/${MISSING}`).set(ADMIN).expect(404);
      await http()
        .patch(`/api/v1/admin/faqs/${MISSING}`)
        .set(ADMIN)
        .send({ sortOrder: 1 })
        .expect(404);
    });

    it('deletes an FAQ and returns not found on a second delete', async () => {
      const created = await create().expect(201);
      await http().delete(`/api/v1/admin/faqs/${created.body.id}`).set(ADMIN).expect(200);
      await http().delete(`/api/v1/admin/faqs/${created.body.id}`).set(ADMIN).expect(404);
    });
  });
});
