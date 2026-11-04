import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { stripSensitiveFields } from '../utils/api-response.util';

export interface StandardApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta: unknown;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, StandardApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<StandardApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusCode = response.statusCode || 200;

    return next.handle().pipe(
      map((resData) => {
        // Skip wrapping if already wrapped in standard envelope
        if (
          resData &&
          typeof resData === 'object' &&
          'success' in resData &&
          'data' in resData
        ) {
          return resData as StandardApiResponse<T>;
        }

        const sanitized = stripSensitiveFields(resData) as Record<string, unknown> | null;

        return {
          success: true,
          statusCode,
          message: 'Operation successful',
          data: (sanitized?.data !== undefined ? sanitized.data : sanitized) as T,
          meta: sanitized?.meta !== undefined ? sanitized.meta : null,
        };
      }),
    );
  }
}

