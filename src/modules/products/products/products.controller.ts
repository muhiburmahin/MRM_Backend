import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/auth.decorators';
import { ProductsService } from './products.service';
import { QueryProductDto } from './dto/query-product.dto';

/** Public, read-only. Only published products are ever returned. */
@ApiTags('Products')
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List published products (public)' })
  list(@Query() query: QueryProductDto) {
    return this.products.listPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published product by slug (public)' })
  detail(@Param('slug') slug: string, @Query('locale') locale = 'en') {
    return this.products.findPublicBySlug(slug, locale);
  }
}
