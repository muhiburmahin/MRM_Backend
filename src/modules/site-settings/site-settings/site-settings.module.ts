import { Module } from '@nestjs/common';
import { SiteSettingsController } from './site-settings.controller';
import { AdminSiteSettingsController } from './admin-site-settings.controller';
import { SiteSettingsService } from './site-settings.service';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SiteSettingsController, AdminSiteSettingsController],
  providers: [SiteSettingsService],
})
export class SiteSettingsModule {}
