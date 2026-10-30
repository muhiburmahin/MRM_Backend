import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/auth.decorators';
import { QueryTeamDto, TeamLocaleQueryDto, TeamSlugParamDto } from './dto/query-team.dto';
import { PublicTeamDetail, PublicTeamListResponse } from './dto/team-response.dto';
import { TeamService } from './team.service';

@ApiTags('team')
@Public()
@Controller({ path: 'team', version: '1' })
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'List public team members (only members who consented and are listed)' })
  @ApiOkResponse({ type: PublicTeamListResponse })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  list(@Query() query: QueryTeamDto) {
    return this.team.listPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a public team member by slug' })
  @ApiOkResponse({ type: PublicTeamDetail })
  @ApiNotFoundResponse({ description: 'Missing, not public, or no translation in this locale' })
  get(@Param() params: TeamSlugParamDto, @Query() query: TeamLocaleQueryDto) {
    return this.team.getPublicBySlug(params.slug, query.locale);
  }
}
