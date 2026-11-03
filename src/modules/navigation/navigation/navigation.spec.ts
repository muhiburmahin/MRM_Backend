import '../../../../test/setup-env';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../../../../test/helpers/create-app';
import { ADMIN, USER } from '../../../../test/helpers/test-guards';
import { FakePrisma } from '../../../../test/helpers/fake-prisma';

describe('Navigation API (e2e)', () => {
  let app: INestApplication;
  let db: FakePrisma;
  const http = () => request(app.getHttpServer());
  const menuId = '00000000-0000-4000-8000-000000000010';
  const pageId = '00000000-0000-4000-8000-000000000011';

  beforeAll(async () => ({ app, db } = await createTestApp()));
  afterAll(() => app.close());
  beforeEach(() => {
    db.navigationMenus.length = 0;
    db.navigationItems.length = 0;
    db.pages.length = 0;
    db.navigationMenus.push({ id: menuId, key: 'header' });
    db.pages.push({ id: pageId, key: 'about' });
  });

  it('requires authentication and the navigation write permission', async () => {
    await http().get('/api/v1/admin/navigation/menus').expect(401);
    await http().get('/api/v1/admin/navigation/menus').set(USER).expect(403);
  });

  it('lists seeded menus and retrieves their items as a nested tree', async () => {
    db.navigationItems.push(
      {
        id: 'parent-item',
        menuId,
        parentId: null,
        label: { en: 'About' },
        description: null,
        badge: null,
        iconKey: null,
        href: '/about',
        pageId: null,
        productId: null,
        serviceId: null,
        newTab: false,
        isButton: false,
        isVisible: true,
        sortOrder: 0,
      },
      {
        id: 'child-item',
        menuId,
        parentId: 'parent-item',
        label: { en: 'Our team' },
        description: null,
        badge: null,
        iconKey: null,
        href: '/team',
        pageId: null,
        productId: null,
        serviceId: null,
        newTab: false,
        isButton: false,
        isVisible: true,
        sortOrder: 0,
      },
    );
    const list = await http().get('/api/v1/admin/navigation/menus').set(ADMIN).expect(200);
    expect(list.body.data).toContainEqual({
      id: menuId,
      key: 'header',
      _count: { items: 2 },
    });
    const menu = await http().get('/api/v1/admin/navigation/menus/header').set(ADMIN).expect(200);
    expect(menu.body.items[0].children[0].id).toBe('child-item');
  });

  it('creates and updates custom menus while preserving seeded menu keys', async () => {
    await http()
      .post('/api/v1/admin/navigation/menus')
      .set(ADMIN)
      .send({ key: 'custom-links' })
      .expect(201);
    await http()
      .patch('/api/v1/admin/navigation/menus/custom-links')
      .set(ADMIN)
      .send({ key: 'company-links' })
      .expect(200);
    await http()
      .patch('/api/v1/admin/navigation/menus/header')
      .set(ADMIN)
      .send({ key: 'main-header' })
      .expect(409);
  });

  it('creates, updates, reorders, and deletes items, while validating target and parent references', async () => {
    const parent = await http()
      .post('/api/v1/admin/navigation/menus/header/items')
      .set(ADMIN)
      .send({ label: { en: 'About' }, pageId, sortOrder: 5 })
      .expect((response) => {
        if (response.status !== 201) throw new Error(JSON.stringify(response.body));
      })
      .expect(201);
    const parentId = parent.body.items[0].id;

    const child = await http()
      .post('/api/v1/admin/navigation/menus/header/items')
      .set(ADMIN)
      .send({ label: { en: 'Our team' }, href: '/team', parentId })
      .expect(201);
    const childId = child.body.items[0].children[0].id;

    await http()
      .patch(`/api/v1/admin/navigation/menus/header/items/${childId}`)
      .set(ADMIN)
      .send({ href: 'https://example.test/team', newTab: true })
      .expect(200);
    await http()
      .patch('/api/v1/admin/navigation/menus/header/items/reorder')
      .set(ADMIN)
      .send({
        items: [
          { id: parentId, sortOrder: 2 },
          { id: childId, sortOrder: 1 },
        ],
      })
      .expect((response) => {
        if (response.status !== 200) throw new Error(JSON.stringify(response.body));
      })
      .expect(200);
    await http()
      .delete(`/api/v1/admin/navigation/menus/header/items/${parentId}`)
      .set(ADMIN)
      .expect(409);
    await http()
      .delete(`/api/v1/admin/navigation/menus/header/items/${childId}`)
      .set(ADMIN)
      .expect(200);
    await http()
      .delete(`/api/v1/admin/navigation/menus/header/items/${parentId}`)
      .set(ADMIN)
      .expect(200);
  });

  it('rejects unsafe links, multiple targets, invalid references, and cross-menu parents', async () => {
    await http()
      .post('/api/v1/admin/navigation/menus/header/items')
      .set(ADMIN)
      .send({ label: { en: 'Unsafe' }, href: 'javascript:alert(1)' })
      .expect(400);
    await http()
      .post('/api/v1/admin/navigation/menus/header/items')
      .set(ADMIN)
      .send({ label: { en: 'Multiple' }, href: '/about', pageId })
      .expect(400);
    await http()
      .post('/api/v1/admin/navigation/menus/header/items')
      .set(ADMIN)
      .send({
        label: { en: 'Missing page' },
        pageId: '00000000-0000-4000-8000-000000000099',
      })
      .expect(400);
    await http()
      .post('/api/v1/admin/navigation/menus/header/items')
      .set(ADMIN)
      .send({ label: { en: 'Nested' }, href: '/nested', parentId: pageId })
      .expect(400);
  });

  it('allows public retrieval of navigation menus without authentication', async () => {
    db.navigationItems.push({
      id: 'pub-item',
      menuId,
      parentId: null,
      label: { en: 'Home' },
      description: null,
      badge: null,
      iconKey: null,
      href: '/',
      pageId: null,
      productId: null,
      serviceId: null,
      newTab: false,
      isButton: false,
      isVisible: true,
      sortOrder: 0,
    });

    const singleRes = await http().get('/api/v1/navigation/header').expect(200);
    expect(singleRes.body.key).toBe('header');
    expect(singleRes.body.items).toHaveLength(1);
    expect(singleRes.body.items[0].href).toBe('/');

    const listRes = await http().get('/api/v1/navigation').expect(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThan(0);
  });
});
