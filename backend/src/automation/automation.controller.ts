import { Controller, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { DeadlineAutomationService } from './deadline-automation.service';

@Controller('automation')
export class AutomationController {
  constructor(private readonly automation: DeadlineAutomationService) {}
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Post('check-deadlines')
  checkDeadlines() { return this.automation.checkDeadlines(); }
}
