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
import { BlogService } from './blog.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { AdminQueryBlogDto } from './dto/query-blog.dto';

@ApiTags('admin / blog')
@ApiCookieAuth()
@Controller({ path: 'admin/blog', version: '1' })
export class AdminBlogController {
  constructor(private readonly blog: BlogService) {}

  @Get()
  @Permissions('post:read')
  @ApiOperation({ summary: 'List posts and translations, including drafts' })
  list(@Query() query: AdminQueryBlogDto) {
    return this.blog.listAdmin(query);
  }

  @Get(':id')
  @Permissions('post:read')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.blog.findOneAdmin(id);
  }

  @Post()
  @Permissions('post:write')
  create(@Body() dto: CreateBlogDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.blog.create(dto, actor);
  }

  @Patch(':id')
  @Permissions('post:write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBlogDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.blog.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions('post:delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a post and its translations' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.blog.remove(id);
  }
}
