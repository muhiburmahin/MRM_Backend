import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mapPrismaError } from './prisma-error.util';

describe('mapPrismaError', () => {
  it('maps P2002 unique constraint violation to 409 Conflict', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique violation', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });

    const result = mapPrismaError(error);
    expect(result).toEqual({
      statusCode: HttpStatus.CONFLICT,
      message: 'A record with this email already exists.',
      error: 'Conflict',
    });
  });

  it('maps P2025 record not found to 404 Not Found', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: 'test',
    });

    const result = mapPrismaError(error);
    expect(result).toEqual({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'The requested record was not found.',
      error: 'Not Found',
    });
  });

  it('maps P2003 foreign key violation to 400 Bad Request', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
      code: 'P2003',
      clientVersion: 'test',
    });

    const result = mapPrismaError(error);
    expect(result).toEqual({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Operation failed due to a related resource constraint.',
      error: 'Bad Request',
    });
  });

  it('maps PrismaClientInitializationError to 503 Service Unavailable', () => {
    const error = new Prisma.PrismaClientInitializationError('Connection failed', 'test');

    const result = mapPrismaError(error);
    expect(result).toEqual({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'Database service is temporarily unavailable.',
      error: 'Service Unavailable',
    });
  });

  it('maps PrismaClientValidationError to 400 Bad Request', () => {
    const error = new Prisma.PrismaClientValidationError('Invalid query args', {
      clientVersion: 'test',
    });

    const result = mapPrismaError(error);
    expect(result).toEqual({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid data format provided for database operation.',
      error: 'Bad Request',
    });
  });

  it('returns null for non-Prisma errors', () => {
    expect(mapPrismaError(new Error('Generic error'))).toBeNull();
    expect(mapPrismaError('string error')).toBeNull();
    expect(mapPrismaError(null)).toBeNull();
  });
});

