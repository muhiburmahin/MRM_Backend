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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdminQueryProductDto } from './dto/query-product.dto';

@ApiTags('admin / products')
@ApiCookieAuth()
@Controller({ path: 'admin/products', version: '1' })
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Permissions('product:read')
  @ApiOperation({ summary: 'List products and translations, including drafts' })
  list(@Query() query: AdminQueryProductDto) {
    return this.products.listAdmin(query);
  }

  @Get(':id')
  @Permissions('product:read')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findOneAdmin(id);
  }

  @Post()
  @Permissions('product:write')
  create(@Body() dto: CreateProductDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.products.create(dto, actor);
  }

  @Patch(':id')
  @Put(':id')
  @Permissions('product:write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.products.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions('product:delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a product and its translations' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.remove(id);
  }
}
