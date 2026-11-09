import { Transform } from 'class-transformer';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { EMAIL_MESSAGES, findEmailProblem } from './email-rules';

/** Removes control characters (keeping tab, LF and CR), zero-width and line-separator characters. */
function stripControl(input: string): string {
  let out = '';
  for (const ch of input) {
    const c = ch.codePointAt(0) as number;
    const isControl = (c < 32 && c !== 9 && c !== 10 && c !== 13) || (c >= 127 && c <= 159);
    const isInvisible = (c >= 0x200b && c <= 0x200f) || c === 0x2028 || c === 0x2029 || c === 0xfeff;
    if (!isControl && !isInvisible) out += ch;
  }
  return out;
}

/** Normalises single-line text: strips control/zero-width chars, collapses whitespace, trims. */
export const cleanLine = (value: unknown): unknown =>
  typeof value === 'string' ? stripControl(value.normalize('NFC')).replace(/\s+/g, ' ').trim() : value;

/** Normalises multi-line text: strips control chars, limits blank lines, trims. */
export const cleanBlock = (value: unknown): unknown =>
  typeof value === 'string'
    ? stripControl(value.normalize('NFC'))
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : value;

export const CleanLine = () => Transform(({ value }) => cleanLine(value));
export const CleanBlock = () => Transform(({ value }) => cleanBlock(value));
export const NormalizeEmail = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

function custom(
  name: string,
  validate: (value: unknown, args: ValidationArguments) => boolean,
  message: (args: ValidationArguments) => string,
  options?: ValidationOptions,
): PropertyDecorator {
  return (object, propertyName) =>
    registerDecorator({
      name,
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      validator: { validate, defaultMessage: message },
    });
}

/** Strict email: format, real-looking domain, not disposable/placeholder. */
export const IsStrictEmail = (options?: ValidationOptions) =>
  custom(
    'isStrictEmail',
    (value) => findEmailProblem(value) === null,
    (args) => EMAIL_MESSAGES[findEmailProblem(args.value) ?? 'format'],
    options,
  );

const NAME = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;
/** A human name: letters, marks, spaces, dots, apostrophes and hyphens only; no digits, URLs or markup. */
export const IsPersonName = (options?: ValidationOptions) =>
  custom(
    'isPersonName',
    (value) => typeof value === 'string' && NAME.test(value),
    () => 'name may only contain letters, spaces, apostrophes, dots and hyphens',
    options,
  );

const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/gi;
/** Free text: rejects markup and link-stuffed spam. */
export const IsCleanMessage = (maxLinks = 2, options?: ValidationOptions) =>
  custom(
    'isCleanMessage',
    (value) => {
      if (typeof value !== 'string') return false;
      if (/<\s*\/?\s*[a-z][^>]*>/i.test(value)) return false;
      return (value.match(URL_PATTERN) ?? []).length <= maxLinks;
    },
    () => 'message must not contain HTML or more than the allowed number of links',
    options,
  );
