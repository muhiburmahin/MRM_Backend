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
import { CurrentUser, Permissions } from '../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CareersService } from './careers.service';
import { CAREERS_PERMISSIONS as P } from './careers.constants';
import { QueryJobsDto } from './dto/job-query.dto';
import { CreateJobDto, UpdateJobDto, UpdateJobStatusDto } from './dto/job-write.dto';
import { AdminJobListItem } from './dto/job-response.dto';

@ApiTags('admin / careers')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in' })
@ApiForbiddenResponse({ description: 'Missing career permission' })
@Controller({ path: 'admin/careers', version: '1' })
export class AdminCareersController {
  constructor(private readonly careers: CareersService) {}

  @Get()
  @Permissions(P.read)
  @ApiOperation({ summary: 'List all job postings for administrators' })
  @ApiOkResponse({ type: [AdminJobListItem] })
  list(@Query() query: QueryJobsDto) {
    return this.careers.listAdmin(query);
  }

  @Get(':id')
  @Permissions(P.read)
  @ApiOperation({ summary: 'Get a job posting by ID for administrators' })
  @ApiNotFoundResponse({ description: 'Job posting not found' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.careers.getAdmin(id);
  }

  @Post()
  @Permissions(P.write)
  @ApiOperation({ summary: 'Create a new job posting' })
  @ApiCreatedResponse()
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Slug already exists' })
  create(@Body() dto: CreateJobDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.careers.create(dto, actor);
  }

  @Put(':id')
  @Permissions(P.write)
  @ApiOperation({ summary: 'Update an existing job posting and translations' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Job posting not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.careers.update(id, dto, actor);
  }

  @Patch(':id/status')
  @Permissions(P.publish)
  @ApiOperation({ summary: 'Open or close a job posting' })
  @ApiNotFoundResponse({ description: 'Job posting not found' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.careers.updateStatus(id, dto, actor);
  }

  @Delete(':id')
  @Permissions(P.delete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a job posting and its translations' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Job posting not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.careers.remove(id, actor);
  }
}
