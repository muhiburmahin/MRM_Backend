import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mapException } from './exception-mapper';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('raw SQL detail: duplicate key value violates...', {
    code,
    clientVersion: 'test',
  });

describe('mapException', () => {
  it('keeps validation messages (array) for 400', () => {
    const r = mapException(
      new BadRequestException(['name must be a string', 'email must be an email']),
    );
    expect(r).toMatchObject({ status: 400, error: 'Bad Request', unexpected: false });
    expect(r.message).toEqual(['name must be a string', 'email must be an email']);
  });

  it('keeps client-safe 404 messages', () => {
    expect(mapException(new NotFoundException('Product not found'))).toMatchObject({
      status: 404,
      message: 'Product not found',
    });
  });

  it('hides internals of 5xx HttpExceptions', () => {
    const r = mapException(new ServiceUnavailableException('db host 10.0.0.5 down'));
    expect(r.status).toBe(503);
    expect(r.message).toBe('Service temporarily unavailable.');
    expect(r.unexpected).toBe(false);
  });

  it('hides internals of a plain 500 and flags it for logging', () => {
    const r = mapException(new InternalServerErrorException('select * from users failed'));
    expect(r).toMatchObject({ status: 500, message: 'Internal server error', unexpected: true });
  });

  it.each([
    ['P2002', 409],
    ['P2025', 404],
    ['P2003', 409],
  ])('maps Prisma %s to HTTP %i without leaking SQL', (code, status) => {
    const r = mapException(prismaError(code));
    expect(r.status).toBe(status);
    expect(String(r.message)).not.toMatch(/SQL|duplicate key/i);
    expect(r.unexpected).toBe(false);
  });

  it('treats unmapped Prisma codes and unknown errors as generic 500', () => {
    expect(mapException(prismaError('P9999'))).toMatchObject({
      status: 500,
      message: 'Internal server error',
      unexpected: true,
    });
    expect(mapException(new Error('boom: secret=abc'))).toMatchObject({
      status: 500,
      message: 'Internal server error',
    });
    expect(mapException('weird')).toMatchObject({ status: 500 });
  });
});
