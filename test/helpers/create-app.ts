import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { AppConfigService } from '../../src/config/app-config.service';
import { PrismaService } from '../../src/database/prisma.service';
import { FakePrisma } from './fake-prisma';

export async function createTestApp(): Promise<{ app: NestExpressApplication; db: FakePrisma }> {
  const db = new FakePrisma();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(db)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, app.get(AppConfigService));
  await app.init();
  return { app, db };
}
