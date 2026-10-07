import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DeadlineAutomationService } from './deadline-automation.service';

@Injectable()
export class DeadlineSchedulerService {
  private readonly logger = new Logger(DeadlineSchedulerService.name);
  constructor(private readonly automation: DeadlineAutomationService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDailyCheck(): Promise<void> {
    try { await this.automation.checkDeadlines(); }
    catch (error) { this.logger.error('Daily deadline check failed.', error instanceof Error ? error.stack : undefined); }
  }
}
