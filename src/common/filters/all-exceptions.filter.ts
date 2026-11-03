import { ArgumentsHost, Catch, ExceptionFilter, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { mapException, ValidationErrorDetail } from './exception-mapper';

export interface ErrorResponseBody {
  success: false;
  statusCode: number;
  error: string;
  message: string | string[];
  requestId?: string;
  path: string;
  timestamp: string;
  details?: ValidationErrorDetail[];
}

export type StandardErrorResponse = ErrorResponseBody;

/** One consistent error shape for the whole API. */
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { id?: string | number }>();
    const response = ctx.getResponse<Response>();

    const mapped = mapException(exception);
    const requestId = request.id !== undefined ? String(request.id) : undefined;

    if (mapped.unexpected) {
      this.logger.error(
        {
          requestId,
          path: request.path,
          errorType: exception instanceof Error ? exception.name : typeof exception,
        },
        'Unhandled server error',
      );
    }

    const body: ErrorResponseBody = {
      success: false,
      statusCode: mapped.status,
      error: mapped.error,
      message: mapped.message,
      requestId,
      path: request.originalUrl?.split('?')[0] ?? request.url,
      timestamp: new Date().toISOString(),
      ...(mapped.details && mapped.details.length > 0 ? { details: mapped.details } : {}),
    };
    response.status(mapped.status).json(body);
  }
}
