import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import type { CreateNavigationItemDto } from './navigation.dto';
import { NavigationService } from './navigation.service';

const actor: AuthenticatedUser = {
  id: 'admin-id',
  sessionId: 'session-id',
  email: 'admin@example.test',
  name: 'Admin',
  uiLocale: 'en',
  mustChangePassword: false,
  twoFactorEnabled: false,
  role: { id: 'role-id', key: 'admin', name: 'Admin' },
  permissions: ['nav:write'],
};

function makePrisma() {
  const menu = { id: 'menu-id', key: 'header' };
  const items: Array<Record<string, unknown>> = [
    {
      id: 'item-parent',
      menuId: menu.id,
      parentId: null,
      label: { en: 'Products' },
      description: null,
      badge: null,
      iconKey: null,
      href: '/products',
      pageId: null,
      productId: null,
      serviceId: null,
      newTab: false,
      isButton: false,
      isVisible: true,
      sortOrder: 0,
    },
    {
      id: 'item-child',
      menuId: menu.id,
      parentId: 'item-parent',
      label: { en: 'Featured' },
      description: null,
      badge: null,
      iconKey: null,
      href: 'https://example.test/featured',
      pageId: null,
      productId: null,
      serviceId: null,
      newTab: true,
      isButton: false,
      isVisible: true,
      sortOrder: 0,
    },
  ];
  const prisma = {
    navMenu: {
      findMany: jest.fn().mockResolvedValue([{ id: menu.id, key: menu.key, _count: { items: 2 } }]),
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { key: string } }) =>
          Promise.resolve(where.key === menu.key ? menu : null),
        ),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: { key: string } }) =>
          Promise.resolve({ id: 'created-menu-id', key: data.key }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: { key: string } }) =>
          Promise.resolve({ id: menu.id, key: data.key }),
        ),
    },
    navItem: {
      findMany: jest
        .fn()
        .mockImplementation(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(
            items.filter((item) =>
              Object.entries(where).every(([key, value]) => item[key] === value),
            ),
          ),
        ),
      findFirst: jest
        .fn()
        .mockImplementation(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(
            items.find((item) =>
              Object.entries(where).every(([key, value]) => item[key] === value),
            ) ?? null,
          ),
        ),
      create: jest.fn().mockResolvedValue({ id: 'created-item-id' }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    language: {
      findMany: jest
        .fn()
        .mockImplementation(({ where }: { where: { code: { in: string[] } } }) =>
          Promise.resolve(
            where.code.in.filter((code) => ['en', 'bn'].includes(code)).map((code) => ({ code })),
          ),
        ),
    },
    page: { findUnique: jest.fn().mockResolvedValue({ id: 'page-id' }) },
    product: { findUnique: jest.fn().mockResolvedValue({ id: 'product-id' }) },
    service: { findUnique: jest.fn().mockResolvedValue({ id: 'service-id' }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest
      .fn()
      .mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  return { prisma, menu, items };
}

describe('NavigationService', () => {
  let prisma: ReturnType<typeof makePrisma>['prisma'];
  let menu: ReturnType<typeof makePrisma>['menu'];
  let items: ReturnType<typeof makePrisma>['items'];
  let service: NavigationService;

  beforeEach(() => {
    ({ prisma, menu, items } = makePrisma());
    service = new NavigationService(prisma as never);
  });

  it('lists menus and returns items nested by their parent references', async () => {
    await expect(service.listMenus()).resolves.toEqual({
      data: [{ id: menu.id, key: 'header', _count: { items: 2 } }],
    });
    const result = await service.getMenu('header');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('item-parent');
    expect(result.items[0].children.map((child: { id: string }) => child.id)).toEqual([
      'item-child',
    ]);
  });

  it('preserves seeded menu keys when updating menus', async () => {
    await expect(
      service.updateMenu('header', { key: 'main-header' }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.navMenu.update).not.toHaveBeenCalled();
  });

  it('creates a localized menu item with one valid target and audits it', async () => {
    await service.createItem('header', { label: { en: 'About' }, pageId: 'page-id' }, actor);
    expect(prisma.navItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          menuId: menu.id,
          label: { en: 'About' },
          pageId: 'page-id',
          href: null,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it.each([
    ['multiple targets', { label: { en: 'About' }, href: '/about', pageId: 'page-id' }],
    ['unsafe URL scheme', { label: { en: 'About' }, href: 'javascript:alert(1)' }],
    ['unknown locale', { label: { xx: 'About' }, href: '/about' }],
  ])('rejects %s', async (_description, input) => {
    await expect(
      service.createItem('header', input as CreateNavigationItemDto, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.navItem.create).not.toHaveBeenCalled();
  });

  it('rejects parents outside the menu and prevents parent cycles', async () => {
    prisma.navItem.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.createItem(
        'header',
        { label: { en: 'Nested' }, href: '/nested', parentId: 'outside-menu' },
        actor,
      ),
    ).rejects.toThrow('Parent navigation item must belong to the same menu');

    prisma.navItem.findFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(items.find((item) => item.id === where.id) ?? null),
    );
    prisma.navItem.findMany.mockResolvedValue([
      { id: 'item-parent', parentId: null },
      { id: 'item-child', parentId: 'item-parent' },
    ]);
    await expect(
      service.updateItem('header', 'item-parent', { parentId: 'item-child' }, actor),
    ).rejects.toThrow('Navigation hierarchy cannot contain a cycle');
    expect(prisma.navItem.update).not.toHaveBeenCalled();
  });

  it('reorders items only when every ID belongs to the requested menu', async () => {
    prisma.navItem.findMany.mockResolvedValueOnce([{ id: 'item-parent' }]);
    await expect(
      service.reorderItems(
        'header',
        {
          items: [
            { id: 'item-parent', sortOrder: 1 },
            { id: 'foreign-item', sortOrder: 0 },
          ],
        },
        actor,
      ),
    ).rejects.toThrow('Every reordered item must belong to the selected menu');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not delete an item that still has children', async () => {
    prisma.navItem.findFirst.mockResolvedValue({
      id: 'item-parent',
      _count: { children: 1 },
    });
    await expect(service.deleteItem('header', 'item-parent', actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.navItem.delete).not.toHaveBeenCalled();
  });
});
