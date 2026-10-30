import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/auth.decorators';
import { PagesService } from './pages.service';
import { PublicPageQueryDto } from './dto/page-query.dto';

@ApiTags('Pages')
@Public()
@Controller({ path: 'pages', version: '1' })
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get a published page by path and locale' })
  getByPath(@Query() query: PublicPageQueryDto) {
    return this.pages.getPublicByPath(query.path, query.locale);
  }
}
