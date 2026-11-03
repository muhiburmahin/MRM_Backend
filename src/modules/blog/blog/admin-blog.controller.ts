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
  Put,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { BlogService } from './blog.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { AdminQueryBlogDto } from './dto/query-blog.dto';
import { CreateCategoryDto, CreateTagDto, UpdateCategoryDto } from './dto/category-tag.dto';

@ApiTags('admin / blog')
@ApiCookieAuth()
@Controller({ path: 'admin/blog', version: '1' })
export class AdminBlogController {
  constructor(private readonly blog: BlogService) {}

  @Get('categories')
  @Permissions('post:read')
  @ApiOperation({ summary: 'List all blog categories' })
  listCategories() {
    return this.blog.listCategories();
  }

  @Post('categories')
  @Permissions('post:write')
  @ApiOperation({ summary: 'Create a blog category' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.blog.createCategory(dto);
  }

  @Put('categories/:id')
  @Permissions('post:write')
  @ApiOperation({ summary: 'Update a blog category' })
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.blog.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Permissions('post:delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a blog category' })
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.blog.deleteCategory(id);
  }

  @Get('tags')
  @Permissions('post:read')
  @ApiOperation({ summary: 'List all blog tags' })
  listTags() {
    return this.blog.listTags();
  }

  @Post('tags')
  @Permissions('post:write')
  @ApiOperation({ summary: 'Create a blog tag' })
  createTag(@Body() dto: CreateTagDto) {
    return this.blog.createTag(dto);
  }

  @Delete('tags/:id')
  @Permissions('post:delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a blog tag' })
  deleteTag(@Param('id', ParseUUIDPipe) id: string) {
    return this.blog.deleteTag(id);
  }

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
