import { registerDecorator, ValidationOptions } from 'class-validator';
import { Transform } from 'class-transformer';

/** Limits the serialized size of a JSON object field (protects DB and API from huge payloads). */
export function MaxJsonSize(maxChars: number, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'maxJsonSize',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} is too large`, ...options },
      validator: {
        validate: (value: unknown) => {
          try {
            return JSON.stringify(value ?? {}).length <= maxChars;
          } catch {
            return false;
          }
        },
      },
    });
}

export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export const ToBoolean = () =>
  Transform(({ value }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  );
