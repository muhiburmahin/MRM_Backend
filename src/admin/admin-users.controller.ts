import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Permissions, Public } from '../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { QueryUsersDto } from './dto/admin-query.dto';
import { InviteUserDto, QueryInvitesDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ChangeUserRoleDto, UpdateUserDto, UpdateUserStatusDto } from './dto/update-user.dto';
import { AdminUsersService } from './admin-users.service';

@ApiTags('Admin users')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Post('invites/accept')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Accept an invitation using its one-time token and set a password' })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.users.acceptInvite(dto);
  }

  @Post('invites')
  @ApiCookieAuth()
  @Permissions('user:invite')
  @ApiOperation({
    summary: 'Create an invitation; the plaintext token is returned once for delivery',
  })
  invite(@Body() dto: InviteUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.invite(dto, actor);
  }

  @Get('invites')
  @ApiCookieAuth()
  @Permissions('user:read')
  @ApiOperation({ summary: 'List pending, accepted, or expired invitations' })
  findInvites(@Query() query: QueryInvitesDto) {
    return this.users.findInvites(query);
  }

  @Delete('invites/:id')
  @ApiCookieAuth()
  @Permissions('user:invite')
  @ApiOperation({ summary: 'Revoke an invitation before it is accepted' })
  revokeInvite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.revokeInvite(id, actor);
  }

  @Get()
  @ApiCookieAuth()
  @Permissions('user:read')
  @ApiOperation({ summary: 'List users with pagination and filters' })
  findAll(@Query() query: QueryUsersDto) {
    return this.users.findAll(query);
  }

  @Get(':id')
  @ApiCookieAuth()
  @Permissions('user:read')
  @ApiOperation({ summary: 'Get a user without credentials or session secrets' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @ApiCookieAuth()
  @Permissions('user:write')
  @ApiOperation({ summary: 'Update a user profile' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Patch(':id/status')
  @ApiCookieAuth()
  @Permissions('user:write')
  @ApiOperation({ summary: 'Activate or deactivate a user account' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.updateStatus(id, dto, actor);
  }

  @Patch(':id/role')
  @ApiCookieAuth()
  @Permissions('user:write', 'role:write')
  @ApiOperation({ summary: 'Assign a role to a user (requires role-management permission)' })
  changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.changeRole(id, dto, actor);
  }

  @Post(':id/revoke-sessions')
  @ApiCookieAuth()
  @Permissions('user:write')
  @ApiOperation({ summary: 'Revoke all active sessions belonging to a user' })
  revokeSessions(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.revokeSessions(id, actor);
  }

  @Delete(':id')
  @ApiCookieAuth()
  @Permissions('user:delete')
  @ApiOperation({ summary: 'Soft-delete a user and revoke active sessions' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.remove(id, actor);
  }
}
