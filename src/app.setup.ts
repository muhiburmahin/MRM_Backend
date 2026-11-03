import { VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import helmet from 'helmet';
import { AppConfigService } from './config/app-config.service';
import { API_DEFAULT_VERSION, API_PREFIX } from './common/constants/api.constants';
import { createValidationPipe } from './common/pipes/validation.pipe';

const SWAGGER_PATH = 'docs';

/**
 * Everything that must be identical in production and in end-to-end tests.
 * (Filters, guards and logging are registered in AppModule so they get dependency injection.)
 */
export function configureApp(app: NestExpressApplication, config: AppConfigService): void {
  app.set('trust proxy', config.trustProxy);

  // Secure HTTP headers. Swagger UI needs inline scripts/styles, so only /docs gets a relaxed CSP.
  const apiHelmet = helmet();
  const docsHelmet = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) =>
    (config.swaggerEnabled && req.path.startsWith(`/${SWAGGER_PATH}`) ? docsHelmet : apiHelmet)(
      req,
      res,
      next,
    ),
  );

  // Explicit allow-list. No wildcard. Empty list => browsers from other origins are refused.
  const origins = config.corsOrigins.filter((origin) => config.authAllowedOrigins.includes(origin));
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    // Cookie sessions are enabled only for exact allow-listed origins; OriginGuard enforces CSRF.
    credentials: true,
    maxAge: 600,
  });

  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_DEFAULT_VERSION });
  app.useGlobalPipes(createValidationPipe());

  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (typeof app.useStaticAssets === 'function') {
    app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });
  }
}

export function setupSwagger(app: NestExpressApplication, config: AppConfigService): void {
  if (!config.swaggerEnabled) return;
  const doc = new DocumentBuilder()
    .setTitle('MRM Infotech API')
    .setDescription('Corporate website backend. Only implemented endpoints are listed.')
    .setVersion('1')
    .addCookieAuth(config.authCookieName, undefined, 'cookie')
    .build();
  SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, doc));
}
