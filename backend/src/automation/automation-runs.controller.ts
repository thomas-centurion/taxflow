import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { AutomationRunsService } from './automation-runs.service';
import { DeadlineAutomationService } from './deadline-automation.service';

/** Per-obligation automation: run the processing now (same roles as the batch check) and read the run history. */
@Controller()
export class AutomationRunsController {
  constructor(private readonly automation: DeadlineAutomationService, private readonly runs: AutomationRunsService) {}

  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Post('tax-obligations/:id/automation-runs')
  run(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.automation.processObligation(id, actor); }

  @Get('tax-obligations/:id/automation-runs')
  list(@Param('id', ParseUUIDPipe) id: string) { return this.runs.listForObligation(id); }

  @Get('automation-runs/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.runs.findOne(id); }
}
