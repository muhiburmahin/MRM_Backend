import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';
import { AppConfigService } from './config/app-config.service';

let cachedApp: NestExpressApplication | null = null;

export async function createApp(): Promise<NestExpressApplication> {
  if (cachedApp) return cachedApp;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(AppConfigService);
  configureApp(app, config);
  setupSwagger(app, config);
  app.enableShutdownHooks();

  const isServerless = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (isServerless) {
    await app.init();
  }
  cachedApp = app;
  return app;
}

// Default export for Vercel Serverless Function invocations
export default async function handler(req: Request, res: Response) {
  const app = await createApp();
  const expressInstance = app.getHttpAdapter().getInstance();
  return expressInstance(req, res);
}

// In standard persistent runtime (local development, Docker container):
if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  void (async () => {
    const app = await createApp();
    const config = app.get(AppConfigService);
    await app.listen(config.port);
    app.get(Logger).log(`API listening on port ${config.port} (${config.nodeEnv})`);
  })();
}
