import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../../../../test/helpers/create-app';
import { ADMIN, USER } from '../../../../test/helpers/test-guards';
import { FakePrisma } from '../../../../test/helpers/fake-prisma';

describe('Testimonials API (e2e)', () => {
  let app: INestApplication;
  let db: FakePrisma;
  const http = () => request(app.getHttpServer());
  const rows = () => db.testimonial.rows;
  const MISSING = '00000000-0000-4000-8000-000000000000';

  const make = (over: Record<string, unknown> = {}) => ({
    authorName: 'Rahim Uddin',
    quote: { en: 'Great work, delivered on time.' },
    ...over,
  });
  const create = (over: Record<string, unknown> = {}) =>
    http().post('/api/v1/admin/testimonials').set(ADMIN).send(make(over));
  const publicTestimonial = (over: Record<string, unknown> = {}) =>
    make({
      authorName: 'First Customer',
      authorRole: 'Director',
      quote: { en: 'Excellent delivery.' },
      isVerified: true,
      evidenceNote: 'Customer approval on file',
      consentAt: '2026-10-12T10:00:00.000Z',
      showOnSite: true,
      ...over,
    });
  const seed = async () => {
    await create(publicTestimonial({ sortOrder: 2 })).expect(201);
    await create({ authorName: 'Hidden Customer', sortOrder: 3 }).expect(201);
    await create(
      publicTestimonial({
        authorName: 'Second Customer',
        sortOrder: 1,
        quote: { en: 'Recommended service.' },
      }),
    ).expect(201);
  };

  beforeAll(async () => ({ app, db } = await createTestApp()));
  afterAll(() => app.close());
  beforeEach(() => {
    rows().length = 0;
  });

  describe('public', () => {
    it('lists only verified, consented, visible testimonials in display order', async () => {
      await seed();
      const response = await http().get('/api/v1/testimonials').expect(200);
      expect(
        response.body.data.map((testimonial: { authorName: string }) => testimonial.authorName),
      ).toEqual(['Second Customer', 'First Customer']);
      expect(response.body.meta).toMatchObject({ page: 1, limit: 20, total: 2, totalPages: 1 });
      expect(response.body.data[0]).toEqual({
        id: expect.any(String),
        authorName: 'Second Customer',
        authorRole: 'Director',
        quote: 'Recommended service.',
      });
      expect(response.body.data[0]).not.toHaveProperty('evidenceNote');
    });

    it('rejects draft-revealing or invalid public query parameters', async () => {
      for (const query of [
        'showOnSite=false',
        'isVerified=false',
        'sortBy=authorName',
        'limit=1000',
        'page=0',
        'order=sideways',
      ]) {
        await http().get(`/api/v1/testimonials?${query}`).expect(400);
      }
    });

    it('returns a visible testimonial by ID and hides non-public and unknown records', async () => {
      await seed();
      const shown = rows().find((row) => row.showOnSite === true);
      const hidden = rows().find((row) => row.showOnSite === false);
      if (!shown || !hidden)
        throw new Error('Testimonial seed did not create visible and hidden rows');
      await http().get(`/api/v1/testimonials/${shown.id}`).expect(200);
      await http().get(`/api/v1/testimonials/${hidden.id}`).expect(404);
      await http().get(`/api/v1/testimonials/${MISSING}`).expect(404);
      await http().get('/api/v1/testimonials/not-a-uuid').expect(400);
    });
  });

  describe('admin', () => {
    it('rejects unauthenticated and non-admin callers', async () => {
      await http().get('/api/v1/admin/testimonials').expect(401);
      await http().post('/api/v1/admin/testimonials').send(make()).expect(401);
      await http().post('/api/v1/admin/testimonials').set(USER).send(make()).expect(403);
      await http().delete(`/api/v1/admin/testimonials/${MISSING}`).set(USER).expect(403);
    });

    it('creates an unpublished testimonial by default and lists private records for admins', async () => {
      const response = await create().expect(201);
      expect(response.body).toMatchObject({
        isVerified: false,
        showOnSite: false,
        sortOrder: 0,
      });
      const drafts = await http()
        .get('/api/v1/admin/testimonials?showOnSite=false')
        .set(ADMIN)
        .expect(200);
      expect(drafts.body.data).toHaveLength(1);
    });

    it.each([
      ['empty quote', { quote: {} }],
      ['blank quote', { quote: { en: '  ' } }],
      ['quote too long', { quote: { en: 'x'.repeat(2001) } }],
      ['client-supplied ID', { id: 'abc' }],
      ['client-supplied creation date', { createdAt: '2020-01-01' }],
    ])('rejects create with %s', async (_label, body) => {
      await create(body).expect(400);
      expect(rows()).toHaveLength(0);
    });

    it('requires evidence and consent before making a testimonial public', async () => {
      await create({ isVerified: true }).expect(400);
      await create({ isVerified: true, evidenceNote: 'Verified' }).expect(201);
      await create({
        isVerified: true,
        evidenceNote: 'Verified',
        showOnSite: true,
      }).expect(400);
      expect(rows()).toHaveLength(1);
    });

    it('requires publish permission and persists publish changes', async () => {
      await http()
        .post('/api/v1/admin/testimonials')
        .set(USER)
        .send(publicTestimonial())
        .expect(403);
      const created = await create().expect(201);
      await http()
        .patch(`/api/v1/admin/testimonials/${created.body.id}`)
        .set(ADMIN)
        .send({
          isVerified: true,
          evidenceNote: 'Written approval received',
          consentAt: '2026-10-12T10:00:00.000Z',
          showOnSite: true,
        })
        .expect(200);
      expect(rows()[0]).toMatchObject({ isVerified: true, showOnSite: true });
      await http().get(`/api/v1/testimonials/${created.body.id}`).expect(200);
      await http()
        .patch(`/api/v1/admin/testimonials/${created.body.id}`)
        .set(ADMIN)
        .send({ id: 'other' })
        .expect(400);
    });

    it('unpublishing hides a testimonial from public reads', async () => {
      const created = await create(publicTestimonial()).expect(201);
      await http().get(`/api/v1/testimonials/${created.body.id}`).expect(200);
      await http()
        .patch(`/api/v1/admin/testimonials/${created.body.id}`)
        .set(ADMIN)
        .send({ showOnSite: false })
        .expect(200);
      await http().get(`/api/v1/testimonials/${created.body.id}`).expect(404);
    });

    it('returns 400 for malformed IDs and 404 for missing testimonials', async () => {
      await http().get('/api/v1/admin/testimonials/not-a-uuid').set(ADMIN).expect(400);
      await http().get(`/api/v1/admin/testimonials/${MISSING}`).set(ADMIN).expect(404);
      await http()
        .patch(`/api/v1/admin/testimonials/${MISSING}`)
        .set(ADMIN)
        .send({ sortOrder: 3 })
        .expect(404);
    });

    it('deletes a testimonial and returns not found on a second delete', async () => {
      const created = await create().expect(201);
      await http().delete(`/api/v1/admin/testimonials/${created.body.id}`).set(ADMIN).expect(200);
      await http().delete(`/api/v1/admin/testimonials/${created.body.id}`).set(ADMIN).expect(404);
    });
  });
});
