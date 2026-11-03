import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/auth.decorators';
import { NavigationService } from './navigation.service';

@ApiTags('Navigation')
@Public()
@Controller({ path: 'navigation', version: '1' })
export class NavigationController {
  constructor(private readonly navigation: NavigationService) {}

  @Get()
  @ApiOperation({ summary: 'List all public navigation menus with hierarchical item trees' })
  @ApiOkResponse({ description: 'List of public navigation menus' })
  list() {
    return this.navigation.listPublicMenus();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get public navigation menu by key with hierarchical item tree' })
  @ApiOkResponse({ description: 'Public navigation menu' })
  @ApiNotFoundResponse({ description: 'Navigation menu not found' })
  get(@Param('key') key: string) {
    return this.navigation.getPublicMenu(key);
  }
}

