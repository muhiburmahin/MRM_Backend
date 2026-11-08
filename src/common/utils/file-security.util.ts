import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';
import * as fs from 'node:fs';

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.svg',
  '.pdf',
  '.gif',
  '.mp4',
  '.webm',
  '.woff',
  '.woff2',
]);

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export function sanitizeUploadFilename(originalName: string): string {
  const base = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.+/g, '.');
  return base.slice(0, 120) || 'upload_file';
}

export function validateUploadExtensionAndMime(originalName: string, mimeType: string): void {
  const ext = extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(`File extension "${ext || 'none'}" is not permitted.`);
  }

  const validPairs: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif'],
    'image/svg+xml': ['.svg'],
    'application/pdf': ['.pdf'],
    'video/mp4': ['.mp4'],
    'video/webm': ['.webm'],
    'font/woff': ['.woff'],
    'font/woff2': ['.woff2'],
  };

  const allowedExtsForMime = validPairs[mimeType];
  if (!allowedExtsForMime || !allowedExtsForMime.includes(ext)) {
    throw new BadRequestException(
      `File extension "${ext}" does not match MIME type "${mimeType}".`,
    );
  }
}

export function validateBufferMagicBytes(buffer: Buffer, mimeType: string): void {
  if (!buffer || buffer.length === 0) {
    throw new BadRequestException('Empty or missing file buffer.');
  }

  let isValid = false;

  switch (mimeType) {
    case 'image/jpeg':
      // JPEG SOI marker: FF D8 FF
      isValid =
        buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      break;

    case 'image/png':
      // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
      isValid =
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a;
      break;

    case 'image/webp':
      // RIFF....WEBP
      isValid =
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP';
      break;

    case 'image/gif':
      // GIF87a or GIF89a
      isValid =
        buffer.length >= 6 &&
        (buffer.toString('ascii', 0, 6) === 'GIF87a' ||
          buffer.toString('ascii', 0, 6) === 'GIF89a');
      break;

    case 'application/pdf':
      // %PDF
      isValid = buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF';
      break;

    case 'image/svg+xml': {
      const content = buffer.toString('utf8', 0, Math.min(buffer.length, 2048)).toLowerCase();
      isValid = content.includes('<svg') || content.includes('<?xml');
      break;
    }

    default:
      isValid = true;
  }

  if (!isValid) {
    throw new BadRequestException(
      `File header magic bytes do not match expected signature for MIME type "${mimeType}".`,
    );
  }
}

export function validateFileSize(size: number, mimeType: string): void {
  let max = MAX_DOCUMENT_SIZE_BYTES;
  if (mimeType.startsWith('image/')) max = MAX_IMAGE_SIZE_BYTES;
  if (mimeType.startsWith('video/')) max = MAX_VIDEO_SIZE_BYTES;

  if (size > max) {
    throw new BadRequestException(
      `File size (${(size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${max / (1024 * 1024)} MB.`,
    );
  }
}

export function validateUploadedFile(file: {
  originalname: string;
  mimetype: string;
  size?: number;
  buffer?: Buffer;
  path?: string;
}): void {
  validateUploadExtensionAndMime(file.originalname, file.mimetype);

  if (file.size !== undefined) {
    validateFileSize(file.size, file.mimetype);
  }

  if (file.buffer && file.buffer.length > 0) {
    validateBufferMagicBytes(file.buffer, file.mimetype);
  } else if (file.path && fs.existsSync(file.path)) {
    const fd = fs.openSync(file.path, 'r');
    try {
      const headerBuf = Buffer.alloc(32);
      const bytesRead = fs.readSync(fd, headerBuf, 0, 32, 0);
      validateBufferMagicBytes(headerBuf.subarray(0, bytesRead), file.mimetype);
    } finally {
      fs.closeSync(fd);
    }
  }
}
