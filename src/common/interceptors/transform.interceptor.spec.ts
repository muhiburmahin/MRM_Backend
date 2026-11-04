import { ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';
import type { Response } from 'express';

describe('TransformInterceptor', () => {
  it('wraps raw objects in standard success envelope and strips sensitive keys', (done) => {
    const interceptor = new TransformInterceptor();
    const mockResponse = { statusCode: 200 } as unknown as Response;

    const mockContext = {
      getType: () => 'http',
      switchToHttp: () => ({ getResponse: () => mockResponse }),
    } as unknown as ExecutionContext;

    const handler = {
      handle: () => of({ id: '1', title: 'Product 1', passwordHash: 'secret' }),
    };

    interceptor.intercept(mockContext, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({
          success: true,
          statusCode: 200,
          message: 'Operation successful',
          data: { id: '1', title: 'Product 1' },
          meta: null,
        });
      },
      complete: () => done(),
    });
  });

  it('preserves already wrapped responses', (done) => {
    const interceptor = new TransformInterceptor();
    const mockResponse = { statusCode: 200 } as unknown as Response;

    const mockContext = {
      getType: () => 'http',
      switchToHttp: () => ({ getResponse: () => mockResponse }),
    } as unknown as ExecutionContext;

    const handler = {
      handle: () =>
        of({
          success: true,
          statusCode: 200,
          message: 'Custom',
          data: { id: '1' },
          meta: null,
        }),
    };

    interceptor.intercept(mockContext, handler).subscribe({
      next: (val) => {
        expect(val.message).toBe('Custom');
        expect(val.data).toEqual({ id: '1' });
      },
      complete: () => done(),
    });
  });
});

