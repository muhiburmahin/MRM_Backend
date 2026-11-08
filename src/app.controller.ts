import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth/decorators/auth.decorators';

@ApiTags('root')
@Public()
@SkipThrottle()
@Controller({ version: VERSION_NEUTRAL })
export class AppController {
  @Get()
  @ApiOkResponse({ description: 'API health & metadata summary' })
  getRoot() {
    return {
      status: 'ok',
      service: 'MRM InfoTech Enterprise Backend API',
      version: 'v1',
      documentation: '/docs',
      health: '/api/v1/health',
      timestamp: new Date().toISOString(),
    };
  }
}
