import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/auth.decorators';
import { ProductsService } from './products.service';
import { QueryProductDto } from './dto/query-product.dto';

/** Public, read-only product endpoints */
@ApiTags('Products')
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List active product categories' })
  categories() {
    return this.products.listCategories();
  }

  @Get()
  @ApiOperation({ summary: 'List published products by placement and category' })
  list(@Query() query: QueryProductDto) {
    return this.products.listPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a product by slug (supports preview=true for drafts)' })
  detail(
    @Param('slug') slug: string,
    @Query('locale') locale = 'en',
    @Query('preview') preview?: string,
  ) {
    const isPreview = preview === 'true';
    return this.products.findPublicBySlug(slug, locale, isPreview);
  }
}
