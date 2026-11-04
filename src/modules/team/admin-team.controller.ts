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
import { AdminQueryTeamDto } from './dto/query-team.dto';
import { AdminTeamListResponse, AdminTeamMember } from './dto/team-response.dto';
import { CreateTeamMemberDto, UpdateTeamMemberDto } from './dto/team-write.dto';
import { TEAM_PERMISSIONS as P } from './team.constants';
import { TeamService } from './team.service';

@ApiTags('admin / team')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in' })
@ApiForbiddenResponse({ description: 'Missing permission' })
@Controller({ path: 'admin/team', version: '1' })
export class AdminTeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @Permissions(P.read)
  @ApiOperation({ summary: 'List all team members incl. non-public' })
  @ApiOkResponse({ type: AdminTeamListResponse })
  list(@Query() query: AdminQueryTeamDto) {
    return this.team.listAdmin(query);
  }

  @Get(':id')
  @Permissions(P.read)
  @ApiOkResponse({ type: AdminTeamMember })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.team.getAdmin(id);
  }

  @Post()
  @Permissions(P.write)
  @ApiOperation({
    summary: 'Create a member (making it public needs content:publish and consentGiven)',
  })
  @ApiCreatedResponse({ type: AdminTeamMember })
  @ApiBadRequestResponse()
  @ApiConflictResponse({ description: 'Slug already exists' })
  create(@Body() dto: CreateTeamMemberDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.team.create(dto, actor);
  }

  @Put(':id')
  @Patch(':id')
  @Permissions(P.write)
  @ApiOperation({ summary: 'Partial update; translations are upserted by locale' })
  @ApiOkResponse({ type: AdminTeamMember })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamMemberDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.team.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions(P.delete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a member (blocked while they are the author of blog posts)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.team.remove(id, actor);
  }
}
