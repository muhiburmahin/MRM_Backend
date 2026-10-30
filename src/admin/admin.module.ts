import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService } from './admin-audit.service';
import { AdminController } from './admin.controller';
import { AdminRolesController } from './admin-roles.controller';
import { AdminRolesService } from './admin-roles.service';
import { AdminService } from './admin.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AdminController, AdminUsersController, AdminRolesController, AdminAuditController],
  providers: [AdminService, AdminUsersService, AdminRolesService, AdminAuditService],
})
export class AdminModule {}
