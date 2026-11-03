import { ExecutionContext, RequestTimeoutException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { TimeoutInterceptor } from './timeout.interceptor';

describe('TimeoutInterceptor', () => {
  let interceptor: TimeoutInterceptor;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new TimeoutInterceptor(reflector);
  });

  const mockContext = {
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  it('passes through successful response within timeout', (done) => {
    const handler = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(mockContext, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true });
      },
      complete: () => done(),
    });
  });

  it('throws RequestTimeoutException when request exceeds timeout', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(50); // 50ms custom timeout

    const handler = {
      handle: () => of({ data: 'slow' }).pipe(delay(100)),
    };

    interceptor.intercept(mockContext, handler).subscribe({
      next: () => done(new Error('Should not emit value')),
      error: (err) => {
        expect(err).toBeInstanceOf(RequestTimeoutException);
        expect(err.message).toBe('Request timed out.');
        done();
      },
    });
  });

  it('does not interfere with normal exceptions', (done) => {
    const originalError = new Error('Custom database error');
    const handler = {
      handle: () => throwError(() => originalError),
    };

    interceptor.intercept(mockContext, handler).subscribe({
      next: () => done(new Error('Should not emit value')),
      error: (err) => {
        expect(err).toBe(originalError);
        done();
      },
    });
  });
});
