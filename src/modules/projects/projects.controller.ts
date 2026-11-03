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
  ProjectLocaleQueryDto,
  ProjectSlugParamDto,
  QueryProjectsDto,
} from './dto/query-projects.dto';
import { PublicProjectDetail, PublicProjectListResponse } from './dto/project-response.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Public()
@Controller({ path: ['projects', 'case-studies'], version: '1' })
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List published, verified projects / case studies' })
  @ApiOkResponse({ type: PublicProjectListResponse })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  list(@Query() query: QueryProjectsDto) {
    return this.projects.listPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published, verified project by slug' })
  @ApiOkResponse({ type: PublicProjectDetail })
  @ApiNotFoundResponse({
    description: 'Missing, not verified/approved/published, or no translation in this locale',
  })
  get(@Param() params: ProjectSlugParamDto, @Query() query: ProjectLocaleQueryDto) {
    return this.projects.getPublicBySlug(params.slug, query.locale);
  }
}
