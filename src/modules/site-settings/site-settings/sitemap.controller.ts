import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/auth.decorators';
import { SiteSettingsService } from './site-settings.service';

@ApiTags('sitemap')
@Public()
@Controller({ path: 'sitemap-data', version: '1' })
export class SitemapController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get published sitemap data across all modules (public)' })
  @ApiOkResponse({ description: 'Sitemap URLs across published models' })
  get() {
    return this.settings.getSitemapData();
  }
}
