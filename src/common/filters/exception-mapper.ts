import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { STATUS_CODES } from 'node:http';

export interface MappedException {
  status: number;
  error: string;
  message: string | string[];
  /** true => unexpected server-side problem that must be logged with its stack */
  unexpected: boolean;
}

const PRISMA_CODE_MAP: Record<string, { status: HttpStatus; message: string }> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    message: 'A record with the same unique value already exists.',
  },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'The requested record was not found.' },
  P2003: { status: HttpStatus.CONFLICT, message: 'The operation conflicts with a related record.' },
  P2014: { status: HttpStatus.CONFLICT, message: 'The operation would break a required relation.' },
};

const INTERNAL = 'Internal server error';
// Deliberate 5xx responses (e.g. readiness 503) get a generic, status-appropriate message.
const GENERIC_5XX: Record<number, string> = { 503: 'Service temporarily unavailable.' };

/**
 * Pure function: turns ANY thrown value into a client-safe status + message.
 * Internal details (SQL, stack traces, driver messages) are never returned.
 */
export function mapException(exception: unknown): MappedException {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    let message: string | string[] = exception.message;
    if (typeof body === 'string') message = body;
    else if (typeof body === 'object' && body !== null && 'message' in body) {
      message = (body as { message: string | string[] }).message;
    }
    const isServerError = status >= 500;
    // Only a plain 500 is a bug worth a stack-trace log; a deliberate 503 is an expected condition.
    const unexpected = status === 500;
    return {
      status,
      error: STATUS_CODES[status] ?? 'Error',
      message: isServerError ? (GENERIC_5XX[status] ?? INTERNAL) : message,
      unexpected,
    };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_CODE_MAP[exception.code];
    if (mapped) {
      return {
        status: mapped.status,
        error: STATUS_CODES[mapped.status] ?? 'Error',
        message: mapped.message,
        unexpected: false,
      };
    }
  }

  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      error: STATUS_CODES[503] ?? 'Service Unavailable',
      message: 'Service temporarily unavailable.',
      unexpected: true,
    };
  }

  return {
    status: 500,
    error: STATUS_CODES[500] ?? 'Internal Server Error',
    message: INTERNAL,
    unexpected: true,
  };
}
