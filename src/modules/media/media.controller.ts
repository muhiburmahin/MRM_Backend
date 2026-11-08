import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import { MediaKind } from '@prisma/client';
import { CurrentUser, Permissions } from '../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { MediaService } from './media.service';
import { CloudinaryService } from './cloudinary.service';
import { QueryMediaDto } from './dto/query-media.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { UploadMediaDto } from './dto/upload-media.dto';

const ALLOWED_MIME_TYPES: Record<string, MediaKind> = {
  'image/jpeg': MediaKind.IMAGE,
  'image/png': MediaKind.IMAGE,
  'image/webp': MediaKind.IMAGE,
  'image/gif': MediaKind.IMAGE,
  'image/svg+xml': MediaKind.IMAGE,
  'application/pdf': MediaKind.DOCUMENT,
  'video/mp4': MediaKind.VIDEO,
  'video/webm': MediaKind.VIDEO,
  'font/woff': MediaKind.FONT,
  'font/woff2': MediaKind.FONT,
  'font/ttf': MediaKind.FONT,
  'font/otf': MediaKind.FONT,
};

const uploadStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const isServerless = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    const dir = isServerless ? join('/tmp', 'uploads') : './uploads';
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      // Fallback for restricted filesystems
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = randomBytes(16).toString('hex');
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

const uploadFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
  }
};

@ApiTags('admin / media')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in' })
@ApiForbiddenResponse({ description: 'Missing media permission' })
@Controller({ path: 'admin/media', version: '1' })
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Post('upload')
  @Permissions('media:upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: uploadStorage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: uploadFilter,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload a media file up to 10MB to storage (Cloudinary or local fallback) and create asset metadata',
  })
  @ApiCreatedResponse()
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('File is required in "file" form field');
    }
    const kind = ALLOWED_MIME_TYPES[file.mimetype] ?? MediaKind.OTHER;
    let alt: unknown = undefined;
    if (dto.alt) {
      try {
        alt = JSON.parse(dto.alt);
      } catch {
        alt = { en: dto.alt };
      }
    } else if (kind === MediaKind.IMAGE) {
      alt = { en: file.originalname };
    }

    let caption: unknown = undefined;
    if (dto.caption) {
      try {
        caption = JSON.parse(dto.caption);
      } catch {
        caption = { en: dto.caption };
      }
    }

    let storageKey = `uploads/${file.filename}`;
    let url = `/uploads/${file.filename}`;
    let sizeBytes = file.size;
    let width: number | null | undefined = undefined;
    let height: number | null | undefined = undefined;

    if (this.cloudinary.isEnabled && file.path) {
      const result = await this.cloudinary.uploadFile(file.path);
      if (result) {
        url = result.url;
        storageKey = result.publicId;
        sizeBytes = result.bytes;
        width = result.width;
        height = result.height;
      }
    }

    return this.mediaService.create(
      {
        kind,
        storageKey,
        url,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes,
        width,
        height,
        folderId: dto.folderId || null,
        alt,
        caption,
      },
      actor,
    );
  }

  @Post('upload-multiple')
  @Permissions('media:upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: uploadStorage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: uploadFilter,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload up to 10 media files to storage (Cloudinary or local fallback) in a single request',
  })
  @ApiCreatedResponse()
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required in "files" form field');
    }

    const items = await Promise.all(
      files.map(async (file) => {
        const kind = ALLOWED_MIME_TYPES[file.mimetype] ?? MediaKind.OTHER;
        const alt = { en: file.originalname };
        let storageKey = `uploads/${file.filename}`;
        let url = `/uploads/${file.filename}`;
        let sizeBytes = file.size;
        let width: number | null | undefined = undefined;
        let height: number | null | undefined = undefined;

        if (this.cloudinary.isEnabled && file.path) {
          const result = await this.cloudinary.uploadFile(file.path);
          if (result) {
            url = result.url;
            storageKey = result.publicId;
            sizeBytes = result.bytes;
            width = result.width;
            height = result.height;
          }
        }

        const asset = await this.mediaService.create(
          {
            kind,
            storageKey,
            url,
            fileName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes,
            width,
            height,
            folderId: null,
            alt,
            caption: undefined,
          },
          actor,
        );

        return {
          id: asset.id,
          url: asset.url,
          fileName: asset.fileName,
          sizeBytes: asset.sizeBytes,
        };
      }),
    );

    return {
      urls: items.map((i) => i.url),
      items,
    };
  }

  @Post()
  @Permissions('media:upload')
  @ApiOperation({
    summary: 'Register media metadata after storage by the configured storage pipeline',
  })
  @ApiCreatedResponse()
  create(@Body() dto: UploadMediaDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.mediaService.create(dto, actor);
  }

  @Get()
  @Permissions('media:upload')
  @ApiOperation({ summary: 'List media assets (paginated)' })
  findAll(@Query() query: QueryMediaDto) {
    return this.mediaService.findAll(query);
  }

  @Get(':id')
  @Permissions('media:upload')
  @ApiOperation({ summary: 'Get media metadata' })
  @ApiNotFoundResponse()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.findOne(id);
  }

  @Delete(':id')
  @Permissions('media:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a media asset metadata record (does not delete provider-stored bytes)',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.mediaService.remove(id, actor);
  }
}
