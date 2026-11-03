import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.pdf']);

export function sanitizeUploadFilename(originalName: string): string {
  const base = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.+/g, '.');
  return base.slice(0, 120) || 'upload_file';
}

export function validateUploadExtensionAndMime(
  originalName: string,
  mimeType: string,
): void {
  const ext = extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(`File extension "${ext || 'none'}" is not permitted.`);
  }

  const validPairs: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/svg+xml': ['.svg'],
    'application/pdf': ['.pdf'],
  };

  const allowedExtsForMime = validPairs[mimeType];
  if (!allowedExtsForMime || !allowedExtsForMime.includes(ext)) {
    throw new BadRequestException(
      `File extension "${ext}" does not match MIME type "${mimeType}".`,
    );
  }
}

