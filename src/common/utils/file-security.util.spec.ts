import { BadRequestException } from '@nestjs/common';
import {
  sanitizeUploadFilename,
  validateUploadExtensionAndMime,
} from './file-security.util';

describe('file-security.util', () => {
  describe('sanitizeUploadFilename', () => {
    it('strips dangerous path traversal and special characters', () => {
      expect(sanitizeUploadFilename('../../etc/passwd')).toBe('._._etc_passwd');
      expect(sanitizeUploadFilename('my file (1) <test>.png')).toBe('my_file__1___test_.png');
    });

    it('limits filename length to 120 characters', () => {
      const longName = 'a'.repeat(200) + '.jpg';
      expect(sanitizeUploadFilename(longName).length).toBe(120);
    });

    it('returns default fallback for empty strings', () => {
      expect(sanitizeUploadFilename('')).toBe('upload_file');
    });
  });

  describe('validateUploadExtensionAndMime', () => {
    it('accepts valid pairs', () => {
      expect(() => validateUploadExtensionAndMime('image.jpg', 'image/jpeg')).not.toThrow();
      expect(() => validateUploadExtensionAndMime('image.png', 'image/png')).not.toThrow();
      expect(() => validateUploadExtensionAndMime('document.pdf', 'application/pdf')).not.toThrow();
      expect(() => validateUploadExtensionAndMime('vector.svg', 'image/svg+xml')).not.toThrow();
      expect(() => validateUploadExtensionAndMime('photo.webp', 'image/webp')).not.toThrow();
    });

    it('rejects disallowed extensions', () => {
      expect(() => validateUploadExtensionAndMime('malicious.exe', 'application/x-msdownload')).toThrow(
        BadRequestException,
      );
      expect(() => validateUploadExtensionAndMime('script.sh', 'application/x-sh')).toThrow(
        BadRequestException,
      );
    });

    it('rejects mismatched extension and MIME type (e.g. spoofed extension)', () => {
      expect(() => validateUploadExtensionAndMime('photo.jpg', 'application/pdf')).toThrow(
        /does not match MIME type/,
      );
      expect(() => validateUploadExtensionAndMime('document.pdf', 'image/png')).toThrow(
        /does not match MIME type/,
      );
    });
  });
});

