import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestTimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const start = process.hrtime.bigint();
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap({
        next: () => {
          if (!res.headersSent) {
            const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
            res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
          }
        },
      }),
    );
  }
}
