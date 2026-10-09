import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThanOrEqual, Repository } from 'typeorm';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { TaxObligationStatus } from '../tax-obligations/tax-obligation-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../audit/audit-action.enum';
import { AuthUser } from '../auth/auth-user';
import { OVERDUE_ELIGIBLE_STATUSES, shouldBecomeOverdue, todayKey } from '../tax-obligations/tax-obligation-rules';
import { AutomationRun, AutomationRunResult, AutomationRunStatus, AutomationRunTrigger } from './automation-run.entity';
import { AutomationError, AutomationErrorCode, AutomationRunsService, AutomationRunView } from './automation-runs.service';

export const PROCESSABLE_STATUSES: readonly TaxObligationStatus[] = [...OVERDUE_ELIGIBLE_STATUSES, TaxObligationStatus.OVERDUE];

export interface DeadlineCheckResult {
  checked: number;
  notificationsCreated: number;
  overdueMarked: number;
  skippedWithoutResponsible: number;
  skippedActiveRun: number;
  failed: number;
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
    private readonly runs: AutomationRunsService,
  ) {}

  async checkDeadlines(now = new Date()): Promise<DeadlineCheckResult> {
    const today = todayKey(now);
    const records = await this.obligations.find({
      where: { status: In([...PROCESSABLE_STATUSES]), dueDate: LessThanOrEqual(addDays(today, this.warningDays)) },
      select: { id: true },
      order: { dueDate: 'ASC' },
    });

    const result: DeadlineCheckResult = { checked: records.length, notificationsCreated: 0, overdueMarked: 0, skippedWithoutResponsible: 0, skippedActiveRun: 0, failed: 0 };
    // cada obligación en su propia ejecución: un fallo no corta el lote
    for (const obligation of records) {
      try {
        const run = await this.execute(obligation.id, AutomationRunTrigger.SCHEDULED, null, now);
        if (run.status === AutomationRunStatus.FAILED) result.failed += 1;
        result.notificationsCreated += run.result?.notificationsCreated ?? 0;
        if (run.result?.overdueMarked) result.overdueMarked += 1;
        if (run.result?.withoutResponsible) result.skippedWithoutResponsible += 1;
      } catch (error) {
        if (error instanceof ConflictException) result.skippedActiveRun += 1;
        else {
          result.failed += 1;
          this.logger.error(`Deadline check could not process obligation ${obligation.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    this.logger.log(`Deadline check completed: ${JSON.stringify(result)}`);
    return result;
  }

  async processObligation(obligationId: string, actor: AuthUser, now = new Date()): Promise<AutomationRunView> {
    const obligation = await this.obligations.findOneBy({ id: obligationId });
    if (!obligation) throw new NotFoundException('Tax obligation not found.');
    if (!PROCESSABLE_STATUSES.includes(obligation.status)) {
      throw new ConflictException(`Only PENDING, IN_PROGRESS or OVERDUE obligations can be processed (current status: ${obligation.status}).`);
    }
    const run = await this.execute(obligationId, AutomationRunTrigger.MANUAL, actor, now);
    return this.runs.findOne(run.id);
  }

  private async execute(obligationId: string, trigger: AutomationRunTrigger, requester: AuthUser | null, now: Date): Promise<AutomationRun> {
    const run = await this.runs.begin(obligationId, trigger, requester);
    let outcome: { obligation: TaxObligation; result: AutomationRunResult };
    try {
      outcome = await this.dataSource.transaction((manager) => this.process(obligationId, run.id, todayKey(now), manager));
    } catch (error) {
      const obligation = await this.obligations.findOne({ where: { id: obligationId }, relations: { company: true } });
      if (!obligation) throw new NotFoundException('Tax obligation not found.');
      await this.runs.fail(run, obligation, error, requester);
      return run;
    }
    await this.runs.succeed(run, outcome.obligation, outcome.result, requester);
    return run;
  }

  private async process(obligationId: string, runId: string, today: string, manager: EntityManager): Promise<{ obligation: TaxObligation; result: AutomationRunResult }> {
    const repository = manager.getRepository(TaxObligation);
    const current = await repository.findOne({ where: { id: obligationId }, relations: { company: true } });
    if (!current) throw new AutomationError(AutomationErrorCode.OBLIGATION_NOT_FOUND, 'The obligation no longer exists.');
    if (!PROCESSABLE_STATUSES.includes(current.status)) {
      throw new AutomationError(AutomationErrorCode.NOT_PROCESSABLE, `The obligation is ${current.status} and no longer needs deadline processing.`);
    }

    const previousStatus = current.status;
    let overdueMarked = false;
    if (shouldBecomeOverdue(current.status, current.dueDate, today)) {
      // update condicional: si otro request cambió el estado no se aplica nada
      const { affected } = await repository.update({ id: current.id, status: current.status }, { status: TaxObligationStatus.OVERDUE });
      if (!affected) throw new AutomationError(AutomationErrorCode.NOT_PROCESSABLE, 'The obligation changed while it was being processed.');
      await this.audit.record({ actorType: 'SYSTEM', action: AuditAction.UPDATE, entity: 'TaxObligation', entityId: current.id, metadata: { automationRunId: runId, changes: { status: { before: current.status, after: TaxObligationStatus.OVERDUE } } } }, manager);
      current.status = TaxObligationStatus.OVERDUE;
      overdueMarked = true;
    }
    const daysUntilDue = daysBetween(today, current.dueDate);
    const notificationsCreated = current.responsibleUserId ? await this.notifications.notifyDeadline(current, daysUntilDue, manager) : 0;
    return {
      obligation: current,
      result: {
        previousStatus, status: current.status, dueDate: current.dueDate, daysUntilDue, overdueMarked, notificationsCreated,
        withoutResponsible: !current.responsibleUserId,
      },
    };
  }
}

function addDays(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return todayKey(date);
}

function daysBetween(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const toUtc = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}
