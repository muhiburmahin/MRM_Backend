import { Module } from '@nestjs/common';
import { SiteSettingsController } from './site-settings.controller';
import { AdminSiteSettingsController } from './admin-site-settings.controller';
import { RedirectsController } from './redirects.controller';
import { SitemapController } from './sitemap.controller';
import { SiteSettingsService } from './site-settings.service';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [
    SiteSettingsController,
    AdminSiteSettingsController,
    RedirectsController,
    SitemapController,
  ],
  providers: [SiteSettingsService],
})
export class SiteSettingsModule {}
