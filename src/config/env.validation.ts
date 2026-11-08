import 'reflect-metadata';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const;

const toBoolean = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? ['true', '1', 'yes'].includes(value.toLowerCase()) : value;

/** Every environment variable the application reads. Validated once at startup. */
export class EnvironmentVariables {
  @IsIn(['development', 'test', 'staging', 'production'])
  NODE_ENV: 'development' | 'test' | 'staging' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  DATABASE_URL!: string;

  /** Comma-separated exact origins. Empty means "no cross-origin access". */
  @IsString()
  CORS_ORIGINS: string = '';

  @IsString()
  AUTH_ALLOWED_ORIGINS: string = '';

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  @IsOptional()
  @IsString()
  SESSION_SECRET?: string;

  @IsOptional()
  @IsString()
  TWO_FACTOR_ENCRYPTION_KEY?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_CLOUD_NAME?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_API_KEY?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_API_SECRET?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  MAIL_ENABLED?: boolean;

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  SMTP_PORT?: number;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM?: string;

  @IsOptional()
  @IsString()
  AUTH_COOKIE_NAME?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY: number = 0;

  @IsIn(LOG_LEVELS)
  LOG_LEVEL: (typeof LOG_LEVELS)[number] = 'info';

  /** Undefined => on in development, off elsewhere. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  SWAGGER_ENABLED?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_TTL_SECONDS: number = 60;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number = 120;

  @IsString()
  APP_TIMEZONE: string = 'Asia/Dhaka';

  /** Process timezone; keep aligned with APP_TIMEZONE for predictable local-time operations. */
  @IsString()
  TZ: string = 'Asia/Dhaka';
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  // Empty strings in .env files mean "not set".
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''));
  const env = plainToInstance(EnvironmentVariables, cleaned, { enableImplicitConversion: false });
  const errors = validateSync(env, { whitelist: false });
  if (errors.length > 0) {
    // Names + rules only. Values are never printed (they may be secrets).
    const details = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('; ');
    throw new Error(`Invalid environment configuration -> ${details}`);
  }

  // Sanitize and validate timezones. In serverless runtime environments (such as Vercel / AWS Lambda),
  // process.env.TZ is automatically injected as ':UTC' or glibc/POSIX syntax, or may carry quotes.
  const sanitizeZone = (val: unknown): string => {
    if (typeof val !== 'string') return '';
    return val.trim().replace(/^['"]+|['"]+$/g, '').replace(/^:+/, '').trim();
  };

  const appTz = sanitizeZone(env.APP_TIMEZONE) || 'Asia/Dhaka';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: appTz });
    env.APP_TIMEZONE = appTz;
  } catch {
    throw new Error('Invalid environment configuration -> APP_TIMEZONE: must be an IANA time zone');
  }

  const rawTz = sanitizeZone(env.TZ);
  if (rawTz) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: rawTz });
      env.TZ = rawTz;
    } catch {
      // In serverless / Lambda environments with non-standard POSIX TZ or legacy formats, fallback safely
      env.TZ = env.APP_TIMEZONE;
    }
  } else {
    env.TZ = env.APP_TIMEZONE;
  }

  // Ensure process.env.TZ is also updated to the clean IANA timezone for runtime consistency
  process.env.TZ = env.TZ;
  process.env.APP_TIMEZONE = env.APP_TIMEZONE;

  const validateOrigins = (rawOrigins: string, name: string): void => {
    const origins = rawOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    const hasInvalidOrigin = origins.some((origin) => {
      try {
        const parsed = new URL(origin);
        return (
          !['http:', 'https:'].includes(parsed.protocol) ||
          parsed.origin !== origin ||
          parsed.username !== '' ||
          parsed.password !== ''
        );
      } catch {
        return true;
      }
    });
    if (hasInvalidOrigin) {
      throw new Error(
        `Invalid environment configuration -> ${name}: must contain exact http(s) origins only`,
      );
    }
  };
  validateOrigins(env.CORS_ORIGINS, 'CORS_ORIGINS');
  validateOrigins(env.AUTH_ALLOWED_ORIGINS, 'AUTH_ALLOWED_ORIGINS');

  return env;
}
