import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { flattenValidationErrors } from '../utils/validation-error.util';

/** Global request validation: unknown properties are rejected, payloads are transformed to DTOs. */
export const createValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) => {
      const details = flattenValidationErrors(errors);
      const messages = details.map((d) => `${d.field}: ${d.message}`);
      return new BadRequestException({
        message: messages.length === 1 ? messages[0] : messages,
        error: 'Bad Request',
        details,
      });
    },
  });
