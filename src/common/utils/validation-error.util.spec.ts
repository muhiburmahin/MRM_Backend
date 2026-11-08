import { ValidationError } from 'class-validator';
import { flattenValidationErrors } from './validation-error.util';

describe('flattenValidationErrors', () => {
  it('extracts constraints from flat validation errors', () => {
    const error = new ValidationError();
    error.property = 'email';
    error.constraints = {
      isEmail: 'email must be an email',
      isNotEmpty: 'email should not be empty',
    };

    const details = flattenValidationErrors([error]);
    expect(details).toEqual([
      { field: 'email', message: 'email must be an email' },
      { field: 'email', message: 'email should not be empty' },
    ]);
  });

  it('recursively flattens nested validation errors with dot-notation path', () => {
    const childError = new ValidationError();
    childError.property = 'city';
    childError.constraints = {
      isNotEmpty: 'city should not be empty',
    };

    const parentError = new ValidationError();
    parentError.property = 'address';
    parentError.children = [childError];

    const details = flattenValidationErrors([parentError]);
    expect(details).toEqual([{ field: 'address.city', message: 'city should not be empty' }]);
  });
});
