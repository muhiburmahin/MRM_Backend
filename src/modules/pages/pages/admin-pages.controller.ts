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
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { CreatePageDto } from './dto/create-page.dto';
import { AdminPageQueryDto } from './dto/page-query.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PagesService } from './pages.service';

@ApiTags('admin / pages')
@ApiCookieAuth()
@Controller({ path: 'admin/pages', version: '1' })
export class AdminPagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @Permissions('page:read')
  @ApiOperation({ summary: 'List pages, including unpublished translations' })
  list(@Query() query: AdminPageQueryDto) {
    return this.pages.listAdmin(query);
  }

  @Get(':id')
  @Permissions('page:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.pages.getAdmin(id);
  }

  @Post()
  @Permissions('page:write')
  create(@Body() dto: CreatePageDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.pages.create(dto, actor);
  }

  @Patch(':id')
  @Permissions('page:write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.pages.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions('page:delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a non-system page with no children or policy versions' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.pages.remove(id, actor);
  }
}
