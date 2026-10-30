import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { PagesService } from './pages.service';

const actor = (permissions: string[]): AuthenticatedUser => ({
  id: 'editor-id',
  sessionId: 'session-id',
  email: 'editor@example.test',
  name: 'Editor',
  uiLocale: 'en',
  mustChangePassword: false,
  twoFactorEnabled: false,
  role: { id: 'role-id', key: 'editor', name: 'Editor' },
  permissions,
});

const translation = {
  locale: 'en',
  path: '/about',
  title: 'About',
  blocks: [{ id: 'main', type: 'hero', data: { heading: 'About' } }],
};

function makePrisma() {
  return {
    page: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    language: {
      findMany: jest
        .fn()
        .mockImplementation(({ where }: { where: { code?: { in: string[] } } }) => {
          const codes = where.code?.in ?? ['en', 'bn'];
          return Promise.resolve(
            codes.filter((code) => ['en', 'bn'].includes(code)).map((code) => ({ code })),
          );
        }),
    },
    mediaAsset: { findUnique: jest.fn().mockResolvedValue(null) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
}

describe('PagesService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: PagesService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new PagesService(prisma as never);
  });

  it('rejects duplicate translation locales before writing', async () => {
    await expect(
      service.create(
        { key: 'about', translations: [translation, translation] },
        actor(['page:write']),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.page.create).not.toHaveBeenCalled();
  });

  it('rejects unregistered block types and unsafe paths', async () => {
    await expect(
      service.create(
        {
          key: 'about',
          translations: [
            { ...translation, blocks: [{ id: 'bad', type: 'script', data: { text: 'bad' } }] },
          ],
        },
        actor(['page:write']),
      ),
    ).rejects.toThrow('Invalid page blocks:');
    await expect(
      service.create(
        { key: 'about', translations: [{ ...translation, path: '/%2fexample.test' }] },
        actor(['page:write']),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.page.create).not.toHaveBeenCalled();
  });

  it('requires the page publish permission when creating published content', async () => {
    await expect(
      service.create(
        {
          key: 'about',
          translations: [{ ...translation, status: ContentStatus.PUBLISHED }],
        },
        actor(['page:write']),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.page.create).not.toHaveBeenCalled();
  });

  it('rejects Open Graph references that do not resolve to an image asset', async () => {
    await expect(
      service.create(
        {
          key: 'about',
          translations: [
            {
              ...translation,
              ogImageId: '00000000-0000-4000-8000-000000000001',
            },
          ],
        },
        actor(['page:write']),
      ),
    ).rejects.toThrow('Open Graph image must reference an existing image asset');
    expect(prisma.page.create).not.toHaveBeenCalled();
  });

  it('rejects a parent update that would create a hierarchy cycle', async () => {
    prisma.page.findUnique
      .mockResolvedValueOnce({
        id: 'page-a',
        key: 'about',
        template: 'default',
        parentId: null,
        sortOrder: 0,
        translations: [],
      })
      .mockResolvedValueOnce({ id: 'page-b' });
    prisma.page.findMany.mockResolvedValue([
      { id: 'page-a', parentId: null },
      { id: 'page-b', parentId: 'page-a' },
    ]);

    await expect(
      service.update('page-a', { parentId: 'page-b' }, actor(['page:write'])),
    ).rejects.toThrow('Page hierarchy cannot contain a cycle');
    expect(prisma.page.update).not.toHaveBeenCalled();
  });
});
