import { BadRequestException } from '@nestjs/common';
import {
  sanitizeUploadFilename,
  validateUploadExtensionAndMime,
  validateBufferMagicBytes,
  validateFileSize,
  validateUploadedFile,
  MAX_IMAGE_SIZE_BYTES,
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
      expect(() =>
        validateUploadExtensionAndMime('malicious.exe', 'application/x-msdownload'),
      ).toThrow(BadRequestException);
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

  describe('validateBufferMagicBytes', () => {
    it('accepts valid JPEG magic bytes', () => {
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(() => validateBufferMagicBytes(jpegBuf, 'image/jpeg')).not.toThrow();
    });

    it('accepts valid PNG magic bytes', () => {
      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(() => validateBufferMagicBytes(pngBuf, 'image/png')).not.toThrow();
    });

    it('accepts valid WebP magic bytes', () => {
      const webpBuf = Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ');
      expect(() => validateBufferMagicBytes(webpBuf, 'image/webp')).not.toThrow();
    });

    it('accepts valid GIF magic bytes', () => {
      const gifBuf = Buffer.from('GIF89a\x01\x00\x01\x00');
      expect(() => validateBufferMagicBytes(gifBuf, 'image/gif')).not.toThrow();
    });

    it('accepts valid PDF magic bytes', () => {
      const pdfBuf = Buffer.from('%PDF-1.7\n%Header');
      expect(() => validateBufferMagicBytes(pdfBuf, 'application/pdf')).not.toThrow();
    });

    it('accepts valid SVG content', () => {
      const svgBuf = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
      );
      expect(() => validateBufferMagicBytes(svgBuf, 'image/svg+xml')).not.toThrow();
    });

    it('rejects invalid/spoofed magic bytes', () => {
      const fakeJpeg = Buffer.from('NOT A REAL JPEG FILE CONTENT');
      expect(() => validateBufferMagicBytes(fakeJpeg, 'image/jpeg')).toThrow(
        /magic bytes do not match expected signature/,
      );

      const fakePng = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
      expect(() => validateBufferMagicBytes(fakePng, 'image/png')).toThrow(
        /magic bytes do not match expected signature/,
      );

      const fakePdf = Buffer.from('<html><body>Fake PDF</body></html>');
      expect(() => validateBufferMagicBytes(fakePdf, 'application/pdf')).toThrow(
        /magic bytes do not match expected signature/,
      );
    });

    it('rejects empty buffer', () => {
      expect(() => validateBufferMagicBytes(Buffer.alloc(0), 'image/jpeg')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateFileSize', () => {
    it('accepts sizes within limit', () => {
      expect(() => validateFileSize(1024 * 1024, 'image/jpeg')).not.toThrow();
    });

    it('rejects sizes exceeding limit', () => {
      expect(() => validateFileSize(MAX_IMAGE_SIZE_BYTES + 1, 'image/jpeg')).toThrow(
        /exceeds maximum allowed limit/,
      );
    });
  });

  describe('validateUploadedFile', () => {
    it('passes for complete valid file', () => {
      const file = {
        originalname: 'avatar.png',
        mimetype: 'image/png',
        size: 5000,
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      };
      expect(() => validateUploadedFile(file)).not.toThrow();
    });

    it('fails if file content does not match reported extension/mime', () => {
      const file = {
        originalname: 'evil.png',
        mimetype: 'image/png',
        size: 500,
        buffer: Buffer.from('echo "malicious payload"'),
      };
      expect(() => validateUploadedFile(file)).toThrow(BadRequestException);
    });
  });
});
