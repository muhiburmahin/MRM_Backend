import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { SiteSettingsService } from './site-settings.service';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';

@ApiTags('Site Settings (admin)')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in' })
@ApiForbiddenResponse({ description: 'Missing settings:write permission' })
@Controller({ path: 'admin/site-settings', version: '1' })
export class AdminSiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  @Permissions('settings:write')
  @ApiOperation({ summary: 'List all site settings, including private settings' })
  list() {
    return this.settings.listAdmin();
  }

  @Get(':key')
  @Permissions('settings:write')
  @ApiOperation({ summary: 'Get a site setting by key' })
  @ApiNotFoundResponse()
  get(@Param('key') key: string) {
    return this.settings.getAdmin(key);
  }

  @Post()
  @Permissions('settings:write')
  @ApiOperation({ summary: 'Create a site setting' })
  @ApiCreatedResponse()
  create(@Body() dto: UpdateSiteSettingsDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.settings.create(dto, actor);
  }

  @Patch(':key')
  @Permissions('settings:write')
  @ApiOperation({ summary: 'Update a site setting' })
  @ApiNotFoundResponse()
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSiteSettingsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.settings.update(key, dto, actor);
  }

  @Delete(':key')
  @Permissions('settings:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a site setting' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async remove(@Param('key') key: string, @CurrentUser() actor: AuthenticatedUser): Promise<void> {
    await this.settings.remove(key, actor);
  }
}
