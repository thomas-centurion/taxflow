import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AutomationController } from './automation.controller';
import { DeadlineAutomationService } from './deadline-automation.service';
import { DeadlineSchedulerService } from './deadline-scheduler.service';
import { AuditModule } from '../audit/audit.module';
import { AutomationRun } from './automation-run.entity';
import { AutomationRunsController } from './automation-runs.controller';
import { AutomationRunsService } from './automation-runs.service';

@Module({
  imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([TaxObligation, AutomationRun]), NotificationsModule, AuditModule],
  controllers: [AutomationController, AutomationRunsController],
  providers: [DeadlineAutomationService, DeadlineSchedulerService, AutomationRunsService],
  exports: [DeadlineAutomationService],
})
export class AutomationModule {}
