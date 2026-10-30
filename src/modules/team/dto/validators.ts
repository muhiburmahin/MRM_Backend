import { Transform } from 'class-transformer';
import { registerDecorator } from 'class-validator';
import { SOCIAL_KEYS } from '../team.constants';

export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export const ToBoolean = () =>
  Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value));

/** https-only URL (rejects javascript:, data:, http:). */
export const isHttpsUrl = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.length > 300) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

/** Object whose keys are in SOCIAL_KEYS and whose values are https URLs. */
export function IsSocialLinks() {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isSocialLinks',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be an object with allowed keys (${SOCIAL_KEYS.join(', ')}) and https URLs` },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'object' && value !== null && !Array.isArray(value) &&
          Object.entries(value).every(([k, v]) => (SOCIAL_KEYS as readonly string[]).includes(k) && isHttpsUrl(v)),
      },
    });
}
