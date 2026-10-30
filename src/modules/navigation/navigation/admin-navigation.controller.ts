import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import {
  CreateNavigationItemDto,
  CreateNavigationMenuDto,
  ReorderNavigationItemsDto,
  UpdateNavigationItemDto,
  UpdateNavigationMenuDto,
} from './navigation.dto';
import { NavigationService } from './navigation.service';

@ApiTags('admin / navigation')
@ApiCookieAuth()
@Controller({ path: 'admin/navigation/menus', version: '1' })
@Permissions('nav:write')
export class AdminNavigationController {
  constructor(private readonly navigation: NavigationService) {}

  @Get()
  @ApiOperation({ summary: 'List navigation menus' })
  listMenus() {
    return this.navigation.listMenus();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a navigation menu and its nested items' })
  getMenu(@Param('key') key: string) {
    return this.navigation.getMenu(key);
  }

  @Post()
  createMenu(@Body() dto: CreateNavigationMenuDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.navigation.createMenu(dto, actor);
  }

  @Patch(':key')
  updateMenu(
    @Param('key') key: string,
    @Body() dto: UpdateNavigationMenuDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.navigation.updateMenu(key, dto, actor);
  }

  @Post(':key/items')
  createItem(
    @Param('key') key: string,
    @Body() dto: CreateNavigationItemDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.navigation.createItem(key, dto, actor);
  }

  @Patch(':key/items/reorder')
  @ApiOperation({ summary: 'Set display order for items in a navigation menu' })
  reorderItems(
    @Param('key') key: string,
    @Body() dto: ReorderNavigationItemsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.navigation.reorderItems(key, dto, actor);
  }

  @Patch(':key/items/:itemId')
  updateItem(
    @Param('key') key: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateNavigationItemDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.navigation.updateItem(key, itemId, dto, actor);
  }

  @Delete(':key/items/:itemId')
  @HttpCode(200)
  deleteItem(
    @Param('key') key: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.navigation.deleteItem(key, itemId, actor);
  }
}
