import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnyAuthenticated, CurrentUser, Permissions } from '../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiCookieAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('me')
  @AnyAuthenticated()
  @ApiOperation({ summary: 'Current authenticated administrator profile' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.getProfile(user);
  }

  @Get('dashboard')
  @Permissions('content:read', 'lead:read', 'user:read')
  @ApiOperation({ summary: 'Dashboard counts across content and business modules' })
  dashboard() {
    return this.admin.getDashboard();
  }
}
