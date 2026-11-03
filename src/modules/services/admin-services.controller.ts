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
import { CurrentUser, Permissions } from '../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AdminQueryServicesDto } from './dto/query-services.dto';
import { AdminServiceListResponse, AdminServiceResponse } from './dto/service-response.dto';
import { CreateServiceDto, UpdateServiceDto } from './dto/service-write.dto';
import { SERVICE_PERMISSIONS as P } from './services.constants';
import { ServicesService } from './services.service';

@ApiTags('admin / services')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in' })
@ApiForbiddenResponse({ description: 'Missing permission' })
@Controller({ path: 'admin/services', version: '1' })
export class AdminServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @Permissions(P.read)
  @ApiOperation({ summary: 'List all services incl. drafts' })
  @ApiOkResponse({ type: AdminServiceListResponse })
  list(@Query() query: AdminQueryServicesDto) {
    return this.services.listAdmin(query);
  }

  @Get(':id')
  @Permissions(P.read)
  @ApiOperation({ summary: 'Service with all translations' })
  @ApiOkResponse({ type: AdminServiceResponse })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.services.getAdmin(id);
  }

  @Post()
  @Permissions(P.write)
  @ApiOperation({ summary: 'Create a service (publishing requires service:publish)' })
  @ApiCreatedResponse({ type: AdminServiceResponse })
  @ApiBadRequestResponse()
  @ApiConflictResponse({ description: 'Slug already exists' })
  create(@Body() dto: CreateServiceDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.services.create(dto, actor);
  }

  @Patch(':id')
  @Permissions(P.write)
  @ApiOperation({ summary: 'Partial update; translations are upserted by locale' })
  @ApiOkResponse({ type: AdminServiceResponse })
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
  @ApiOperation({ summary: 'Delete a service (blocked while leads or case studies reference it)' })
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
