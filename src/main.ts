import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(AppConfigService);
  configureApp(app, config);
  setupSwagger(app, config);
  app.enableShutdownHooks(); // closes the DB connection on SIGTERM/SIGINT

  await app.listen(config.port);
  app.get(Logger).log(`API listening on port ${config.port} (${config.nodeEnv})`);
}

void bootstrap();
