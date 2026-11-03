import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { REQUEST_ID_HEADER } from './common/constants/api.constants';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './admin/admin.module';
import { BlogModule } from './modules/blog/blog/blog.module';
import { CareersModule } from './modules/careers/careers.module';
import { CompanyModule } from './modules/company/company/company.module';
import { ContactModule } from './modules/contact/contact.module';
import { FaqsModule } from './modules/faqs/faqs/faqs.module';
import { MediaModule } from './modules/media/media.module';
import { NavigationModule } from './modules/navigation/navigation.module';
import { PagesModule } from './modules/pages/pages.module';
import { ProductsModule } from './modules/products/products/products.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ServicesModule } from './modules/services/services.module';
import { SiteSettingsModule } from './modules/site-settings/site-settings/site-settings.module';
import { TeamModule } from './modules/team/team.module';
import { TestimonialsModule } from './modules/testimonials/testimonials/testimonials.module';

const SAFE_REQUEST_ID = /^[\w-]{8,64}$/; // reject anything that could pollute logs

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          genReqId: (req, res) => {
            const incoming = req.headers[REQUEST_ID_HEADER];
            const id =
              typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
                ? incoming
                : randomUUID();
            res.setHeader(REQUEST_ID_HEADER, id);
            return id;
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers.x-api-key',
              'req.headers.x-csrf-token',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.oldPassword',
              'req.body.passwordHash',
              'req.body.token',
              'req.body.accessToken',
              'req.body.refreshToken',
              'req.body.sessionToken',
              'req.body.secret',
              'req.body.twoFactorSecret',
              'req.body.twoFactorCode',
              'req.body.totp',
              'req.body.recoveryCode',
            ],
            censor: '[redacted]',
          },
          autoLogging: { ignore: (req) => (req.url ?? '').includes('/health') },
          transport: config.isDevelopment
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => [
        { name: 'default', ttl: config.throttle.ttlMs, limit: config.throttle.limit },
      ],
    }),
    DatabaseModule,
    AuthModule,
    AdminModule,
    BlogModule,
    CareersModule,
    CompanyModule,
    ContactModule,
    FaqsModule,
    MediaModule,
    NavigationModule,
    PagesModule,
    ProductsModule,
    ProjectsModule,
    ServicesModule,
    SiteSettingsModule,
    TeamModule,
    TestimonialsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
