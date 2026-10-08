import { Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { ApiErrorResponses, ApiJwtAuth } from '../common/swagger/api-docs.decorators';
import { UserRole } from '../users/user-role.enum';
import { DeadlineCheckResultDto } from './dto/automation-run-response.dto';
import { DeadlineAutomationService } from './deadline-automation.service';

@ApiTags('Automation Runs')
@ApiJwtAuth()
@Controller('automation')
export class AutomationController {
  constructor(private readonly automation: DeadlineAutomationService) {}

  @ApiOperation({
    summary: 'Runs the daily deadline check now. ADMIN, TAX_MANAGER.',
    description: 'Processes every open or overdue obligation due within 7 days, each in its own SCHEDULED automation run.',
  })
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Post('check-deadlines')
  @ApiCreatedResponse({ type: DeadlineCheckResultDto })
  @ApiErrorResponses(403)
  checkDeadlines() { return this.automation.checkDeadlines(); }
}
