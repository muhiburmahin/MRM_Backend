import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/auth.decorators';
import { BlogService } from './blog.service';
import { QueryBlogDto } from './dto/query-blog.dto';

/** Public, read-only. Only published posts are ever returned. */
@ApiTags('Blog')
@Public()
@Controller('blog')
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List all blog categories (public)' })
  categories() {
    return this.blog.listCategories();
  }

  @Get('tags')
  @ApiOperation({ summary: 'List all blog tags (public)' })
  tags() {
    return this.blog.listTags();
  }

  @Get()
  @ApiOperation({ summary: 'List published posts (public)' })
  list(@Query() query: QueryBlogDto) {
    return this.blog.listPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published post by slug (public)' })
  detail(@Param('slug') slug: string, @Query('locale') locale = 'en') {
    return this.blog.findPublicBySlug(slug, locale);
  }
}
