import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/auth.decorators';
import { SiteSettingsService } from './site-settings.service';

/** Public, read-only. */
@ApiTags('Site Settings')
@Public()
@Controller('site-settings')
export class SiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get public site settings (public)' })
  get() {
    return this.settings.getPublic();
  }
}
