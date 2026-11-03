import {
  stripSensitiveFields,
  buildPaginationMeta,
  wrapSuccessResponse,
} from './api-response.util';

describe('api-response.util', () => {
  describe('stripSensitiveFields', () => {
    it('removes sensitive keys from objects', () => {
      const user = {
        id: 'u-123',
        email: 'user@example.com',
        passwordHash: '$2b$10$secretHashValue',
        twoFactorSecretEnc: 'encSecret',
        tokenHash: 'thash',
        codeHash: 'chash',
        role: 'ADMIN',
      };

      const sanitized = stripSensitiveFields(user);
      expect(sanitized).toEqual({
        id: 'u-123',
        email: 'user@example.com',
        role: 'ADMIN',
      });
      expect(sanitized).not.toHaveProperty('passwordHash');
      expect(sanitized).not.toHaveProperty('twoFactorSecretEnc');
      expect(sanitized).not.toHaveProperty('tokenHash');
      expect(sanitized).not.toHaveProperty('codeHash');
    });

    it('sanitizes objects inside arrays', () => {
      const users = [
        { id: '1', passwordHash: 'hash1', name: 'User 1' },
        { id: '2', passwordHash: 'hash2', name: 'User 2' },
      ];

      const sanitized = stripSensitiveFields(users);
      expect(sanitized).toEqual([
        { id: '1', name: 'User 1' },
        { id: '2', name: 'User 2' },
      ]);
    });

    it('preserves Date instances and primitives', () => {
      const now = new Date();
      expect(stripSensitiveFields(now)).toBe(now);
      expect(stripSensitiveFields(42)).toBe(42);
      expect(stripSensitiveFields('hello')).toBe('hello');
      expect(stripSensitiveFields(null)).toBeNull();
      expect(stripSensitiveFields(undefined)).toBeUndefined();
    });
  });

  describe('buildPaginationMeta', () => {
    it('calculates total pages correctly', () => {
      const meta = buildPaginationMeta(95, 1, 10);
      expect(meta).toEqual({
        page: 1,
        limit: 10,
        total: 95,
        totalPages: 10,
      });
    });

    it('safely handles zero total items and edge limits', () => {
      const meta = buildPaginationMeta(0, 0, 0);
      expect(meta).toEqual({
        page: 1,
        limit: 1,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe('wrapSuccessResponse', () => {
    it('wraps payload in standardized success envelope and strips sensitive keys', () => {
      const response = wrapSuccessResponse(
        { id: '1', name: 'MRM Product', passwordHash: 'leak' },
        'Product retrieved successfully',
        { page: 1, limit: 10, total: 1, totalPages: 1 },
        200,
      );

      expect(response).toEqual({
        success: true,
        statusCode: 200,
        message: 'Product retrieved successfully',
        data: { id: '1', name: 'MRM Product' },
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
    });
  });
});

