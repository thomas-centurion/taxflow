import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { Roles } from '../auth/roles.decorator';
import { ApiErrorResponses, ApiJwtAuth } from '../common/swagger/api-docs.decorators';
import { UserRole } from '../users/user-role.enum';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { PaginatedAuditLogsDto } from './dto/audit-log-response.dto';
import { AuditLogService } from './audit-log.service';

@ApiTags('Audit Logs')
@ApiJwtAuth()
@Controller('audit-logs')
@Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogService) {}

  @ApiOperation({
    summary: 'Lists audit events, newest first. ADMIN, TAX_MANAGER.',
    description: 'ADMIN sees every event; TAX_MANAGER only business entities (companies, obligations, documents, notifications, automation runs). `dateFrom` and `dateTo` are inclusive YYYY-MM-DD days in the backend timezone.',
  })
  @Get()
  @ApiOkResponse({ type: PaginatedAuditLogsDto })
  @ApiErrorResponses([400, 'Invalid filter, or dateFrom is after dateTo.'], 403)
  findAll(@CurrentUser() user: AuthUser, @Query() query: AuditLogQueryDto) {
    return this.auditLogs.findAll(query, user.role);
  }
}
