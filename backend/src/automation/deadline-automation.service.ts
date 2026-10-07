import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThanOrEqual, Repository } from 'typeorm';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { TaxObligationStatus } from '../tax-obligations/tax-obligation-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../audit/audit-action.enum';

export interface DeadlineCheckResult {
  checked: number;
  notificationsCreated: number;
  overdueMarked: number;
  skippedWithoutResponsible: number;
}

@Injectable()
export class DeadlineAutomationService {
  private readonly logger = new Logger(DeadlineAutomationService.name);
  private readonly warningDays = 7;

  constructor(
    @InjectRepository(TaxObligation) private readonly obligations: Repository<TaxObligation>,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditLogService,
  ) {}

  async checkDeadlines(now = new Date()): Promise<DeadlineCheckResult> {
    const today = dateKey(now);
    const lastWarningDate = addDays(today, this.warningDays);
    const records = await this.obligations.find({
      where: {
        status: In([TaxObligationStatus.PENDING, TaxObligationStatus.IN_PROGRESS, TaxObligationStatus.SUBMITTED, TaxObligationStatus.OVERDUE]),
        dueDate: LessThanOrEqual(lastWarningDate),
      },
      relations: { company: true },
      order: { dueDate: 'ASC' },
    });

    const result: DeadlineCheckResult = { checked: records.length, notificationsCreated: 0, overdueMarked: 0, skippedWithoutResponsible: 0 };
    for (const obligation of records) {
      await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(TaxObligation);
        const current = await repository.findOne({ where: { id: obligation.id }, relations: { company: true } });
        if (!current) return;
        const daysUntilDue = daysBetween(today, current.dueDate);
        if (daysUntilDue < 0 && current.status !== TaxObligationStatus.OVERDUE) {
          await repository.update({ id: current.id, status: current.status }, { status: TaxObligationStatus.OVERDUE });
          await this.audit.record({ actorType: 'SYSTEM', action: AuditAction.UPDATE, entity: 'TaxObligation', entityId: current.id, metadata: { changes: { status: { before: current.status, after: TaxObligationStatus.OVERDUE } } } }, manager);
          result.overdueMarked += 1;
          current.status = TaxObligationStatus.OVERDUE;
        }
        if (!current.responsibleUserId) {
          result.skippedWithoutResponsible += 1;
          return;
        }
        result.notificationsCreated += await this.notifications.notifyDeadline(current, daysUntilDue, manager);
      });
    }
    this.logger.log(`Deadline check completed: ${JSON.stringify(result)}`);
    return result;
  }
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return dateKey(date);
}

function daysBetween(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const toUtc = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}
