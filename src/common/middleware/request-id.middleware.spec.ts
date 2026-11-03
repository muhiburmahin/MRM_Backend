import { RequestIdMiddleware, resolveSafeRequestId } from './request-id.middleware';
import type { Request, Response } from 'express';

describe('RequestIdMiddleware', () => {
  describe('resolveSafeRequestId', () => {
    it('accepts incoming valid alphanumeric request IDs', () => {
      const valid = 'req-12345678-abcd';
      expect(resolveSafeRequestId(valid)).toBe(valid);
    });

    it('generates a new unique request ID for invalid or malicious headers', () => {
      const invalid = 'bad/id<script>';
      const resolved = resolveSafeRequestId(invalid);
      expect(resolved).toMatch(/^req_[a-f0-9]{32}$/);
      expect(resolved).not.toBe(invalid);
    });

    it('generates a new request ID when header is missing', () => {
      const resolved = resolveSafeRequestId(undefined);
      expect(resolved).toMatch(/^req_[a-f0-9]{32}$/);
    });

    it('handles array incoming headers safely', () => {
      const valid = 'req-array-valid-id-123';
      expect(resolveSafeRequestId([valid])).toBe(valid);
    });
  });

  describe('middleware use()', () => {
    it('sets req.id, req.headers, and response X-Request-Id header', () => {
      const middleware = new RequestIdMiddleware();
      const req = {
        headers: { 'x-request-id': 'custom-req-id-123' },
      } as unknown as Request & { id?: string };

      const setHeader = jest.fn();
      const res = { setHeader } as unknown as Response;
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(req.id).toBe('custom-req-id-123');
      expect(req.headers['x-request-id']).toBe('custom-req-id-123');
      expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'custom-req-id-123');
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});

