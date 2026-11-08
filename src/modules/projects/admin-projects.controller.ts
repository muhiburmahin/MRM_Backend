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
import { AdminQueryProjectsDto } from './dto/query-projects.dto';
import { AdminProject, AdminProjectListResponse } from './dto/project-response.dto';
import { CreateProjectDto, UpdateProjectDto } from './dto/project-write.dto';
import { PROJECT_PERMISSIONS as P } from './projects.constants';
import { ProjectsService } from './projects.service';

@ApiTags('admin / projects')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in' })
@ApiForbiddenResponse({ description: 'Missing permission' })
@Controller({ path: 'admin/projects', version: '1' })
export class AdminProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @Permissions(P.read)
  @ApiOperation({
    summary: 'List all projects incl. drafts, with a visibility report (why not public yet)',
  })
  @ApiOkResponse({ type: AdminProjectListResponse })
  list(@Query() query: AdminQueryProjectsDto) {
    return this.projects.listAdmin(query);
  }

  @Get(':id')
  @Permissions(P.read)
  @ApiOkResponse({ type: AdminProject })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.getAdmin(id);
  }

  @Post()
  @Permissions(P.write)
  @ApiOperation({
    summary: 'Create a case study (verification/publishing fields need casestudy:publish)',
  })
  @ApiCreatedResponse({ type: AdminProject })
  @ApiBadRequestResponse()
  @ApiConflictResponse({ description: 'Slug already exists' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.projects.create(dto, actor);
  }

  @Patch(':id')
  @Permissions(P.write)
  @ApiOperation({ summary: 'Partial update; translations are upserted by locale' })
  @ApiOkResponse({ type: AdminProject })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.projects.update(id, dto, actor);
  }

  @Put(':id')
  @Permissions(P.write)
  @ApiOperation({ summary: 'Full or partial update; translations are upserted by locale' })
  @ApiOkResponse({ type: AdminProject })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.projects.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions(P.delete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.projects.remove(id, actor);
  }
}
