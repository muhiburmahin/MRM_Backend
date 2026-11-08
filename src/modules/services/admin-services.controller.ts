import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ContentStatus } from '@prisma/client';
import { CurrentUser, Permissions } from '../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AdminQueryServicesDto } from './dto/query-services.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ReorderServicesDto } from './dto/reorder-services.dto';
import { UpdateServiceSectionDto } from './dto/update-service-section.dto';
import { SERVICE_PERMISSIONS as P } from './services.constants';
import { ServicesService } from './services.service';

@ApiTags('admin / services')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in' })
@ApiForbiddenResponse({ description: 'Missing permission' })
@Controller({ path: 'admin/services', version: '1' })
export class AdminServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get('categories')
  @Permissions(P.read)
  @ApiOperation({ summary: 'List all service categories' })
  listCategories() {
    return this.services.getCategoriesAdmin();
  }

  @Post('categories')
  @Permissions(P.write)
  @ApiOperation({ summary: 'Create a new service category' })
  createCategory(
    @Body()
    dto: {
      name: string;
      slug: string;
      description?: string;
      icon?: string;
      displayOrder?: number;
    },
  ) {
    return this.services.createCategory(dto);
  }

  @Patch('categories/:id')
  @Permissions(P.write)
  @ApiOperation({ summary: 'Update a service category' })
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      name?: string;
      slug?: string;
      description?: string;
      icon?: string;
      displayOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.services.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Permissions(P.delete)
  @ApiOperation({ summary: 'Delete a service category' })
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.services.deleteCategory(id);
  }

  @Get()
  @Permissions(P.read)
  @ApiOperation({ summary: 'List all services with KPI summary stats and filters' })
  list(@Query() query: AdminQueryServicesDto) {
    return this.services.listAdmin(query);
  }

  @Patch('reorder')
  @Permissions(P.write)
  @ApiOperation({
    summary: 'Batch priority reorder (servicesPageOrder, homepageOrder, navbarOrder)',
  })
  reorder(@Body() dto: ReorderServicesDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.services.reorder(dto, actor);
  }

  @Get(':id')
  @Permissions(P.read)
  @ApiOperation({ summary: 'Get full service details with all sub-collections' })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.services.getAdmin(id);
  }

  @Post()
  @Permissions(P.write)
  @ApiOperation({ summary: 'Create a new service' })
  @ApiBadRequestResponse()
  @ApiConflictResponse({ description: 'Slug already exists' })
  create(@Body() dto: CreateServiceDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.services.create(dto, actor);
  }

  @Post(':id/duplicate')
  @Permissions(P.write)
  @ApiOperation({ summary: 'Duplicate an existing service as draft' })
  duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.services.duplicate(id, actor);
  }

  @Patch(':id/status')
  @Permissions(P.publish)
  @ApiOperation({ summary: 'Quick toggle status (PUBLISHED, DRAFT, ARCHIVED)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: ContentStatus },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.services.updateStatus(id, body, actor);
  }

  @Patch(':id/section')
  @Permissions(P.write)
  @ApiOperation({
    summary: 'Independent Per-Tab Saving (basic, offerings, benefits, process, etc.)',
  })
  updateSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceSectionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.services.updateSection(id, dto.section, dto.data, actor);
  }

  @Put(':id')
  @Patch(':id')
  @Permissions(P.write)
  @ApiOperation({ summary: 'Full update of a service record' })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.services.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions(P.delete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a service' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.services.remove(id, actor);
  }
}
