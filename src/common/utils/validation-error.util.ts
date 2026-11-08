import type { ValidationError } from 'class-validator';

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorDetail[] {
  const details: ValidationErrorDetail[] = [];

  for (const err of errors) {
    const propertyPath = parentPath ? `${parentPath}.${err.property}` : err.property;

    if (err.constraints) {
      for (const message of Object.values(err.constraints)) {
        details.push({
          field: propertyPath,
          message,
        });
      }
    }

    if (err.children && err.children.length > 0) {
      details.push(...flattenValidationErrors(err.children, propertyPath));
    }
  }

  return details;
}
