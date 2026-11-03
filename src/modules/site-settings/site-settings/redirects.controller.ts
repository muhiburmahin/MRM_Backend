import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/auth.decorators';
import { SiteSettingsService } from './site-settings.service';

@ApiTags('redirects')
@Public()
@Controller({ path: 'redirects', version: '1' })
export class RedirectsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'List all active website redirects (public)' })
  @ApiOkResponse({ description: 'List of active redirects' })
  get() {
    return this.settings.getRedirects();
  }
}

