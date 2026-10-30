import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { MediaService } from './media.service';
import { UploadMediaDto } from './dto/upload-media.dto';

describe('MediaService', () => {
  const actor = { id: 'user-1' } as AuthenticatedUser;
  const prisma = {
    mediaAsset: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    auditLog: { create: jest.fn() },
    caseStudy: { findFirst: jest.fn() },
    client: { findFirst: jest.fn() },
    pageTranslation: { findFirst: jest.fn() },
    post: { findFirst: jest.fn() },
    postTranslation: { findFirst: jest.fn() },
    product: { findFirst: jest.fn() },
    productTranslation: { findFirst: jest.fn() },
    teamMember: { findFirst: jest.fn() },
    technology: { findFirst: jest.fn() },
    trustBadge: { findFirst: jest.fn() },
    theme: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
    fontAsset: { findFirst: jest.fn() },
    productScreenshot: { findFirst: jest.fn() },
    caseStudyMedia: { findFirst: jest.fn() },
  };
  const service = new MediaService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('requires localized alt text for image assets', async () => {
    await expect(service.create({ kind: 'IMAGE' } as UploadMediaDto, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('registers provider-neutral metadata without writing to a guessed storage backend', async () => {
    const asset = { id: 'asset-1', kind: 'IMAGE', mimeType: 'image/png' };
    prisma.mediaAsset.create.mockResolvedValue(asset);
    await service.create(
      {
        kind: 'IMAGE',
        storageKey: 'public/site/logo.png',
        url: 'https://cdn.example.com/logo.png',
        fileName: 'logo.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        alt: { en: 'Company logo' },
      } as UploadMediaDto,
      actor,
    );
    expect(prisma.mediaAsset.create.mock.calls[0][0].data).toMatchObject({
      storageKey: 'public/site/logo.png',
      uploadedById: 'user-1',
      alt: { en: 'Company logo' },
    });
  });
});
