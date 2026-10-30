import { ValidationPipe } from '@nestjs/common';

/** Global request validation: unknown properties are rejected, payloads are transformed to DTOs. */
export const createValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
  });
