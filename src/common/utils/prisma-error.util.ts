import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface MappedPrismaError {
  statusCode: number;
  message: string;
  error: string;
}

export function mapPrismaError(exception: unknown): MappedPrismaError | null {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2002': {
        const target = Array.isArray(exception.meta?.target)
          ? exception.meta.target.join(', ')
          : 'field';
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${target} already exists.`,
          error: 'Conflict',
        };
      }
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'The requested record was not found.',
          error: 'Not Found',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Operation failed due to a related resource constraint.',
          error: 'Bad Request',
        };
      case 'P2014':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'The operation would break a required relation.',
          error: 'Conflict',
        };
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Database request could not be processed.',
          error: 'Bad Request',
        };
    }
  }

  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'Database service is temporarily unavailable.',
      error: 'Service Unavailable',
    };
  }

  if (exception instanceof Prisma.PrismaClientValidationError) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid data format provided for database operation.',
      error: 'Bad Request',
    };
  }

  return null;
}
