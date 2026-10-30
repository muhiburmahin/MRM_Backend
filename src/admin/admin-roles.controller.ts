import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AdminRolesService } from './admin-roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@ApiTags('Admin roles and permissions')
@ApiCookieAuth()
@Controller('admin')
export class AdminRolesController {
  constructor(private readonly roles: AdminRolesService) {}

  @Get('roles')
  @Permissions('user:read')
  @ApiOperation({ summary: 'List roles and their granted permissions' })
  findAll() {
    return this.roles.findAll();
  }

  @Get('permissions')
  @Permissions('user:read')
  @ApiOperation({ summary: 'List available permission keys' })
  findPermissions() {
    return this.roles.findPermissions();
  }

  @Post('roles')
  @Permissions('role:write')
  @ApiOperation({ summary: 'Create a role with explicit permission grants' })
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.roles.create(dto, actor);
  }

  @Patch('roles/:id')
  @Permissions('role:write')
  @ApiOperation({ summary: 'Update a role and optionally replace its permissions' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.roles.update(id, dto, actor);
  }

  @Delete('roles/:id')
  @Permissions('role:write')
  @ApiOperation({ summary: 'Delete a non-system role not used by users or invitations' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.roles.remove(id, actor);
  }
}
