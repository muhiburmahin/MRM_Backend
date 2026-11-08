import { VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { json, urlencoded } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import helmet from 'helmet';
import { AppConfigService } from './config/app-config.service';
import { API_DEFAULT_VERSION, API_PREFIX } from './common/constants/api.constants';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

const SWAGGER_PATH = 'docs';

/**
 * Everything that must be identical in production and in end-to-end tests.
 * (Filters, guards and logging are registered in AppModule so they get dependency injection.)
 */
export function configureApp(app: NestExpressApplication, config: AppConfigService): void {
  // Trust proxy configuration for correct client IP detection behind reverse proxies
  if (config.trustProxy !== undefined) {
    app.set('trust proxy', config.trustProxy);
  }

  // Correlation ID middleware: ensures every request and response has an X-Request-Id header
  app.use(new RequestIdMiddleware().use);

  // Request body size limits to prevent denial-of-service via oversized payloads
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

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

  // Configure CORS to allow both production, local, and all Vercel deployments (*.vercel.app)
  const allowedOrigins = Array.from(
    new Set([
      ...config.corsOrigins,
      ...config.authAllowedOrigins,
      process.env.APP_URL,
      process.env.PROD_APP_URL,
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5000',
      'http://localhost:5173',
    ].filter((o): o is string => Boolean(o && typeof o === 'string'))),
  );

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl, server-side fetch)
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/$/, '');
      const isAllowed =
        allowedOrigins.includes(cleanOrigin) ||
        /^https:\/\/.*\.vercel\.app$/.test(cleanOrigin) ||
        /^http:\/\/localhost(:\d+)?$/.test(cleanOrigin);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Request-Id',
      'X-CSRF-Token',
      'x-request-id',
      'x-csrf-token',
    ],
    exposedHeaders: ['Set-Cookie', 'x-request-id'],
    maxAge: 600,
  });

  app.setGlobalPrefix(API_PREFIX, { exclude: ['/', 'docs'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_DEFAULT_VERSION });
  app.useGlobalPipes(createValidationPipe());

  try {
    const isServerless = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    const uploadsDir = isServerless
      ? path.join('/tmp', 'uploads')
      : path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    if (typeof app.useStaticAssets === 'function') {
      app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });
    }
  } catch {
    // Read-only filesystem in serverless environments (AWS Lambda / Vercel)
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
