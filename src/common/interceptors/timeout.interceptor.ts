import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

export const TIMEOUT_KEY = 'request_timeout_ms';
export const DEFAULT_TIMEOUT_MS = 15000;

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector = new Reflector()) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const customTimeout = this.reflector.getAllAndOverride<number | undefined>(TIMEOUT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const timeoutDuration = customTimeout !== undefined ? customTimeout : DEFAULT_TIMEOUT_MS;

    // If timeout is set to 0 or negative, skip timeout handling
    if (timeoutDuration <= 0) {
      return next.handle();
    }

    return next.handle().pipe(
      timeout(timeoutDuration),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException('Request timed out.'));
        }
        return throwError(() => err);
      }),
    );
  }
}

