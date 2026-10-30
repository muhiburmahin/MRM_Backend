import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/auth.decorators';
import { QueryAuditLogsDto } from './dto/admin-query.dto';
import { AdminAuditService } from './admin-audit.service';

@ApiTags('Admin audit logs')
@ApiCookieAuth()
@Controller('admin/audit-logs')
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get()
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Search and paginate audit log entries' })
  findAll(@Query() query: QueryAuditLogsDto) {
    return this.audit.findAll(query);
  }
}
