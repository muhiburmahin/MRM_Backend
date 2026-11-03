import { ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { RequestTimingInterceptor } from './request-timing.interceptor';
import type { Response } from 'express';

describe('RequestTimingInterceptor', () => {
  it('sets X-Response-Time header on HTTP responses', (done) => {
    const interceptor = new RequestTimingInterceptor();
    const setHeader = jest.fn();
    const mockResponse = { headersSent: false, setHeader } as unknown as Response;

    const mockContext = {
      getType: () => 'http',
      switchToHttp: () => ({ getResponse: () => mockResponse }),
    } as unknown as ExecutionContext;

    const handler = { handle: () => of({ success: true }) };

    interceptor.intercept(mockContext, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true });
        expect(setHeader).toHaveBeenCalledWith(
          'X-Response-Time',
          expect.stringMatching(/^[0-9.]+ms$/),
        );
      },
      complete: () => done(),
    });
  });

  it('bypasses non-http contexts', (done) => {
    const interceptor = new RequestTimingInterceptor();
    const mockContext = {
      getType: () => 'rpc',
    } as unknown as ExecutionContext;

    const handler = { handle: () => of({ success: true }) };

    interceptor.intercept(mockContext, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true });
      },
      complete: () => done(),
    });
  });
});

