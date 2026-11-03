import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { SiteSettingsService } from './site-settings.service';
import { CreateRedirectDto } from './dto/redirect.dto';

@ApiTags('admin / redirects')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in' })
@Controller({ path: 'admin/redirects', version: '1' })
export class AdminRedirectsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  @Permissions('redirect:write')
  @ApiOperation({ summary: 'List all redirects for administrators' })
  list() {
    return this.settings.listAdminRedirects();
  }

  @Post()
  @Permissions('redirect:write')
  @ApiOperation({ summary: 'Create a new URL redirect' })
  create(@Body() dto: CreateRedirectDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.settings.createRedirect(dto, actor);
  }

  @Delete(':id')
  @Permissions('redirect:write')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a URL redirect' })
  @ApiNotFoundResponse({ description: 'Redirect not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.settings.deleteRedirect(id, actor);
  }
}

