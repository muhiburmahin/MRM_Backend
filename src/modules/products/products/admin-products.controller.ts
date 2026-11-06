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
import { ContentStatus, LaunchStage } from '@prisma/client';
import { CurrentUser, Permissions } from '../../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdminQueryProductDto } from './dto/query-product.dto';
import { ReorderProductsDto } from './dto/reorder-products.dto';
import { UpdateProductSectionDto } from './dto/update-product-section.dto';

@ApiTags('admin / products')
@ApiCookieAuth()
@Controller({ path: 'admin/products', version: '1' })
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Permissions('product:read')
  @ApiOperation({ summary: 'List products and KPI summary metrics' })
  list(@Query() query: AdminQueryProductDto) {
    return this.products.listAdmin(query);
  }

  @Patch('reorder')
  @Permissions('product:write')
  @ApiOperation({ summary: 'Multi-context reordering (displayOrder, homepageOrder, navOrder)' })
  reorder(@Body() dto: ReorderProductsDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.products.reorder(dto, actor);
  }

  @Get(':id')
  @Permissions('product:read')
  @ApiOperation({ summary: 'Get full product details including all relations' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findOneAdmin(id);
  }

  @Post()
  @Permissions('product:write')
  @ApiOperation({ summary: 'Create a new product or draft' })
  create(@Body() dto: CreateProductDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.products.create(dto, actor);
  }

  @Post(':id/duplicate')
  @Permissions('product:write')
  @ApiOperation({ summary: 'Clone product with all relations as a new draft' })
  duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.products.duplicate(id, actor);
  }

  @Patch(':id/status')
  @Permissions('product:publish')
  @ApiOperation({ summary: 'Quick status and stage toggle' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: ContentStatus; stage?: LaunchStage },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.products.updateStatus(id, body, actor);
  }

  @Patch(':id/section')
  @Permissions('product:write')
  @ApiOperation({ summary: 'Independent Per-Tab saving (basic, media, features, etc.)' })
  updateSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductSectionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.products.updateSection(id, dto.section, dto.data, actor);
  }

  @Patch(':id')
  @Put(':id')
  @Permissions('product:write')
  @ApiOperation({ summary: 'Update complete product record' })
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
  @ApiOperation({ summary: 'Delete a product and all cascading child relations' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.remove(id);
  }
}
