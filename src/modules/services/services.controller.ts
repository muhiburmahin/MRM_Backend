import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../auth/decorators/auth.decorators';
import {
  QueryServicesDto,
  ServiceLocaleQueryDto,
  ServiceSlugParamDto,
} from './dto/query-services.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@Public()
@Controller({ path: 'services', version: '1' })
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List active service categories (public)' })
  listCategories() {
    return this.services.getCategoriesPublic();
  }

  @Get()
  @ApiOperation({ summary: 'List published services with placement filtering (public)' })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  list(@Query() query: QueryServicesDto) {
    return this.services.listPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published service by slug with all sub-collections (public)' })
  @ApiNotFoundResponse({ description: 'Missing, inactive, or not published' })
  get(@Param() params: ServiceSlugParamDto, @Query() query: ServiceLocaleQueryDto) {
    return this.services.getPublicBySlug(params.slug, query.locale);
  }
}
