import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './env.validation';

/** The ONLY place that reads configuration. Feature code injects this, never process.env. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  private get<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv() {
    return this.get('NODE_ENV');
  }
  get isProduction() {
    return this.nodeEnv === 'production';
  }
  get isDevelopment() {
    return this.nodeEnv === 'development';
  }
  get port() {
    return this.get('PORT');
  }
  get databaseUrl() {
    return this.get('DATABASE_URL');
  }
  get trustProxy() {
    return this.get('TRUST_PROXY');
  }
  get logLevel() {
    return this.get('LOG_LEVEL');
  }
  get timezone() {
    return this.get('APP_TIMEZONE');
  }
  get throttle() {
    return { ttlMs: this.get('THROTTLE_TTL_SECONDS') * 1000, limit: this.get('THROTTLE_LIMIT') };
  }
  get corsOrigins(): string[] {
    return this.get('CORS_ORIGINS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  get authAllowedOrigins(): string[] {
    return this.get('AUTH_ALLOWED_ORIGINS')
      .split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean);
  }
  get authCookieName(): string {
    return this.get('AUTH_COOKIE_NAME') ?? 'mrm_session';
  }
  get swaggerEnabled(): boolean {
    return this.get('SWAGGER_ENABLED') ?? this.isDevelopment;
  }
}
