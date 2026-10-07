import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
@Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogService) {}
  @Get() findAll(@CurrentUser() user: AuthUser, @Query() query: AuditLogQueryDto) {
    return this.auditLogs.findAll(query, user.role);
  }
}
