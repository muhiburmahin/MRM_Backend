import { Transform } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';
import { MAX_METRICS } from '../projects.constants';

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

export function MaxJsonSize(maxChars: number, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'maxJsonSize',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} is too large`, ...options },
      validator: {
        validate: (v: unknown) => {
          try {
            return JSON.stringify(v ?? {}).length <= maxChars;
          } catch {
            return false;
          }
        },
      },
    });
}

export interface Metric {
  label: string;
  value: string;
}

export const isMetricList = (v: unknown): v is Metric[] =>
  Array.isArray(v) &&
  v.length <= MAX_METRICS &&
  v.every(
    (m) =>
      typeof m === 'object' &&
      m !== null &&
      !Array.isArray(m) &&
      Object.keys(m).every((k) => k === 'label' || k === 'value') &&
      typeof (m as Metric).label === 'string' &&
      (m as Metric).label.trim().length > 0 &&
      (m as Metric).label.length <= 80 &&
      typeof (m as Metric).value === 'string' &&
      (m as Metric).value.trim().length > 0 &&
      (m as Metric).value.length <= 40,
  );

/** Array of { label, value } strings (max 10). Only verifiable figures belong here. */
export function IsMetrics() {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isMetrics',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be an array (max ${MAX_METRICS}) of { label, value } strings`,
      },
      validator: { validate: (v: unknown) => isMetricList(v) },
    });
}
