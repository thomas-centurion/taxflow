import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ApiErrorResponses, ApiJwtAuth } from '../common/swagger/api-docs.decorators';
import { UserRole } from '../users/user-role.enum';
import { AutomationRunResponseDto } from './dto/automation-run-response.dto';
import { AutomationRunsService } from './automation-runs.service';
import { DeadlineAutomationService } from './deadline-automation.service';

@ApiTags('Automation Runs')
@ApiJwtAuth()
@Controller()
export class AutomationRunsController {
  constructor(private readonly automation: DeadlineAutomationService, private readonly runs: AutomationRunsService) {}

  @ApiOperation({
    summary: 'Processes the obligation now and returns the finished run. ADMIN, TAX_MANAGER.',
    description: 'A processing failure is part of the run (status FAILED), not an HTTP error.',
  })
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Post('tax-obligations/:id/automation-runs')
  @ApiCreatedResponse({ type: AutomationRunResponseDto })
  @ApiErrorResponses(400, 403, 404, [409, 'The obligation is SUBMITTED, APPROVED or CANCELLED, or is already being processed.'])
  run(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.automation.processObligation(id, actor); }

  @ApiOperation({ summary: 'Last 20 runs of the obligation (manual and scheduled), newest first.' })
  @Get('tax-obligations/:id/automation-runs')
  @ApiOkResponse({ type: [AutomationRunResponseDto] })
  @ApiErrorResponses(400, 404)
  list(@Param('id', ParseUUIDPipe) id: string) { return this.runs.listForObligation(id); }

  @ApiOperation({ summary: 'Gets one automation run.' })
  @Get('automation-runs/:id')
  @ApiOkResponse({ type: AutomationRunResponseDto })
  @ApiErrorResponses(400, 404)
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.runs.findOne(id); }
}
