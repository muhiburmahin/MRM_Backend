import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-app';
import { ADMIN, USER } from './helpers/test-guards';
import { FakePrisma } from './helpers/fake-prisma';

describe('Contact and leads API (e2e)', () => {
  let app: INestApplication;
  let db: FakePrisma;

  const valid = {
    name: 'Rahim Uddin',
    email: '  Rahim@Acme-Industries.com ',
    message: 'I would like a quote for a website.',
    consentGiven: true,
  };
  const publicContact = () => request(app.getHttpServer()).post('/api/v1/contact');
  const adminLeads = () => request(app.getHttpServer()).get('/api/v1/admin/leads');

  beforeAll(async () => ({ app, db } = await createTestApp()));
  afterAll(async () => app.close());
  beforeEach(() => {
    db.contact.rows.length = 0;
  });

  describe('POST /api/v1/contact', () => {
    it('accepts a valid submission and stores normalized email with NEW status', async () => {
      const response = await publicContact().send(valid).expect(201);

      expect(response.body).toMatchObject({ message: expect.any(String) });
      expect(db.contact.rows).toHaveLength(1);
      expect(db.contact.rows[0]).toMatchObject({
        email: 'rahim@acme-industries.com',
        status: 'NEW',
      });
      expect(db.contact.rows[0].consentAt).toBeInstanceOf(Date);
    });

    it.each([
      ['missing name', { ...valid, name: undefined }],
      ['invalid email', { ...valid, email: 'not-an-email' }],
      ['message too short', { ...valid, message: 'short' }],
      ['message too long', { ...valid, message: 'x'.repeat(2001) }],
      ['invalid phone', { ...valid, phone: 'abc' }],
      ['missing consent', { ...valid, consentGiven: undefined }],
      ['false consent', { ...valid, consentGiven: false }],
    ])('rejects %s with 400', async (_label, body) => {
      await publicContact().send(body).expect(400);
      expect(db.contact.rows).toHaveLength(0);
    });

    it.each([
      ['no @ sign', 'plainaddress'],
      ['missing domain', 'name@'],
      ['missing local part', '@company.com'],
      ['no TLD', 'name@company'],
      ['one-letter TLD', 'name@company.c'],
      ['numeric TLD / IP literal', 'name@192.168.0.1'],
      ['consecutive dots', 'na..me@company.com'],
      ['leading dot in domain', 'name@.company.com'],
      ['hyphen-edged label', 'name@-company.com'],
      ['spaces inside', 'na me@company.com'],
      ['two @ signs', 'a@b@company.com'],
      ['placeholder domain', 'name@example.com'],
      ['reserved TLD', 'name@company.test'],
      ['disposable provider', 'name@mailinator.com'],
      ['disposable sub-domain', 'name@box.yopmail.com'],
      ['over-long address', `${'a'.repeat(250)}@company.com`],
    ])('rejects strict email failure: %s', async (_label, email) => {
      const response = await publicContact().send({ ...valid, email }).expect(400);
      expect(JSON.stringify(response.body.details)).toContain('email');
      expect(db.contact.rows).toHaveLength(0);
    });

    it.each([
      ['a numeric name', { name: 'R4him 99' }],
      ['a URL in the name', { name: 'http://spam.biz' }],
      ['HTML in the message', { message: 'Hello <script>alert(1)</script> there' }],
      ['link-stuffed spam', { message: 'see http://a.io http://b.io http://c.io for deals' }],
      ['a whitespace-only message', { message: '            ' }],
    ])('rejects %s', async (_label, patch) => {
      await publicContact().send({ ...valid, ...patch }).expect(400);
      expect(db.contact.rows).toHaveLength(0);
    });

    it('accepts international names and plus-addressed emails, normalising whitespace', async () => {
      await publicContact()
        .send({ ...valid, name: "  Zoë   O'Brien-Müller ", email: 'zoe+quote@acme-industries.co.uk' })
        .expect(201);
      expect(db.contact.rows[0]).toMatchObject({ name: "Zoë O'Brien-Müller", email: 'zoe+quote@acme-industries.co.uk' });
    });

    it('applies the same strict email rule to the start-project endpoint', async () => {
      const body = { name: 'Karim Ahmed', email: 'karim@mailinator.com', message: 'We need a logistics platform.', consentGiven: true };
      await request(app.getHttpServer()).post('/api/v1/contact/start-project').send(body).expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/contact/start-project')
        .send({ ...body, email: 'karim@acme-logistics.com' })
        .expect(201);
    });

    it('rejects client-supplied restricted fields', async () => {
      for (const extra of [{ status: 'WON' }, { internalNote: 'x' }, { id: 'abc' }]) {
        await publicContact()
          .send({ ...valid, ...extra })
          .expect(400);
      }
      expect(db.contact.rows).toHaveLength(0);
    });
  });

  describe('admin leads routes', () => {
    const seed = async (count = 3) => {
      for (let index = 0; index < count; index++) {
        await publicContact()
          .send({ ...valid, name: `Person ${String.fromCharCode(65 + index)}`, email: `p${index}@acme-industries.com` })
          .expect(201);
      }
    };

    it('requires authentication and lead permissions', async () => {
      await adminLeads().expect(401);
      await adminLeads().set(USER).expect(403);
      await request(app.getHttpServer())
        .patch('/api/v1/admin/leads/00000000-0000-4000-8000-000000000000')
        .set(USER)
        .send({ status: 'CONTACTED' })
        .expect(403);
    });

    it('lists leads with pagination and supports search/status filters', async () => {
      await seed();

      const response = await adminLeads().query({ page: 1, limit: 2 }).set(ADMIN).expect(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });

      const filtered = await adminLeads().query({ search: 'person b' }).set(ADMIN).expect(200);
      expect(filtered.body.data).toHaveLength(1);
      const none = await adminLeads().query({ status: 'WON' }).set(ADMIN).expect(200);
      expect(none.body.data).toHaveLength(0);
    });

    it.each(['limit=1000', 'page=0', 'status=BOGUS', 'sortBy=password', 'order=sideways'])(
      'rejects invalid list query "%s"',
      async (query) => {
        await adminLeads().query(query).set(ADMIN).expect(400);
      },
    );

    it('updates lead status and adds an internal note; rejects unknown fields', async () => {
      await seed(1);
      const lead = db.contact.rows[0];
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/leads/${lead.id}`)
        .set(ADMIN)
        .send({ status: 'CONTACTED', internalNote: 'Called back' })
        .expect(200);

      expect(lead.status).toBe('CONTACTED');
      expect(lead.notes[0].body).toBe('Called back');
      expect(lead.changes[0]).toMatchObject({ from: 'NEW', to: 'CONTACTED' });

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/leads/${lead.id}`)
        .set(ADMIN)
        .send({ email: 'evil@acme-industries.com' })
        .expect(400);
    });

    it('soft-deletes a lead and no longer lists it', async () => {
      await seed(1);
      const leadId = db.contact.rows[0].id;

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/leads/${leadId}`)
        .set(ADMIN)
        .expect(204);
      expect(db.contact.rows[0].deletedAt).toBeInstanceOf(Date);
      await request(app.getHttpServer())
        .get(`/api/v1/admin/leads/${leadId}`)
        .set(ADMIN)
        .expect(404);
    });
  });
});
