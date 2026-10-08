import { ConflictException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditAction } from '../audit/audit-action.enum';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthUser } from '../auth/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { AutomationRun, AutomationRunResult, AutomationRunStatus, AutomationRunTrigger } from './automation-run.entity';

export enum AutomationErrorCode {
  OBLIGATION_NOT_FOUND = 'OBLIGATION_NOT_FOUND',
  NOT_PROCESSABLE = 'NOT_PROCESSABLE',
  INTERRUPTED = 'INTERRUPTED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/** Expected processing failure, stored on the run with a stable code and a non-sensitive message. */
export class AutomationError extends Error {
  constructor(readonly code: AutomationErrorCode, message: string) { super(message); }
}

export interface AutomationRunView {
  id: string;
  taxObligationId: string;
  trigger: AutomationRunTrigger;
  status: AutomationRunStatus;
  requestedBy: { id: string; firstName: string; lastName: string } | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  result: AutomationRunResult | null;
  createdAt: Date;
}

/** Spanish explanations for failure notifications (the API keeps stable codes; the frontend has its own labels). */
const FAILURE_REASONS: Record<AutomationErrorCode, string> = {
  OBLIGATION_NOT_FOUND: 'la obligación ya no existe.',
  NOT_PROCESSABLE: 'la obligación ya no está pendiente, en curso ni vencida.',
  INTERRUPTED: 'el servidor se reinició antes de terminar. Los cambios se descartaron y se reprocesará en la próxima ejecución.',
  INTERNAL_ERROR: 'ocurrió un error interno.',
};

const ACTIVE_STATUSES = [AutomationRunStatus.PENDING, AutomationRunStatus.RUNNING];

/**
 * Lifecycle of AutomationRun records: PENDING → RUNNING → SUCCEEDED | FAILED, with audit events and
 * notifications for each outcome. What a run actually does lives in DeadlineAutomationService.
 */
@Injectable()
export class AutomationRunsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AutomationRunsService.name);

  constructor(
    @InjectRepository(AutomationRun) private readonly runs: Repository<AutomationRun>,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Runs left PENDING/RUNNING by a previous process can never finish. Their processing ran in a
   * transaction that was rolled back, so marking them FAILED is safe; the next run redoes the work.
   */
  async onApplicationBootstrap(): Promise<void> {
    const stale = await this.runs.find({ where: { status: In(ACTIVE_STATUSES) }, relations: { taxObligation: { company: true } } });
    for (const run of stale) {
      await this.fail(run, run.taxObligation, new AutomationError(AutomationErrorCode.INTERRUPTED, 'The server restarted before the run finished.'), null);
    }
  }

  /** Records a new run and moves it to RUNNING. Throws 409 when the obligation already has an active run. */
  async begin(taxObligationId: string, trigger: AutomationRunTrigger, requester: AuthUser | null): Promise<AutomationRun> {
    let run: AutomationRun;
    try {
      run = await this.runs.save(this.runs.create({ taxObligationId, trigger, requestedById: requester?.id ?? null, status: AutomationRunStatus.PENDING }));
    } catch (error) {
      // The partial unique index guarantees a single active run per obligation, also under concurrency.
      if ((error as { driverError?: { code?: string } }).driverError?.code === '23505') {
        throw new ConflictException('This obligation is already being processed.');
      }
      throw error;
    }
    run.status = AutomationRunStatus.RUNNING;
    run.startedAt = new Date();
    await this.runs.save(run);
    await this.audit.record({ ...actorOf(requester), action: AuditAction.AUTOMATION_STARTED, entity: 'AutomationRun', entityId: run.id, metadata: { taxObligationId, trigger } });
    return run;
  }

  async succeed(run: AutomationRun, obligation: TaxObligation, result: AutomationRunResult, requester: AuthUser | null): Promise<void> {
    run.status = AutomationRunStatus.SUCCEEDED;
    run.finishedAt = new Date();
    run.result = { ...result, durationMs: durationOf(run) };
    await this.runs.save(run);
    await this.audit.record({
      ...actorOf(requester), action: AuditAction.AUTOMATION_SUCCEEDED, entity: 'AutomationRun', entityId: run.id,
      metadata: { taxObligationId: obligation.id, trigger: run.trigger, overdueMarked: result.overdueMarked, notificationsCreated: result.notificationsCreated },
    });
    // Scheduled successes are already reported by the deadline notifications; only a person who asked gets a confirmation.
    if (requester) {
      await this.notifications.notifyAutomationResult({
        runId: run.id,
        taxObligationId: obligation.id,
        userIds: [requester.id],
        title: 'Procesamiento completado',
        message: `"${obligation.name}" de ${obligation.company?.name ?? 'la empresa'} se procesó correctamente: ${summarize(result)}`,
      });
    }
  }

  async fail(run: AutomationRun, obligation: TaxObligation | null, error: unknown, requester: AuthUser | null): Promise<void> {
    const failure = error instanceof AutomationError ? error : new AutomationError(AutomationErrorCode.INTERNAL_ERROR, 'Unexpected error while processing the obligation.');
    if (!(error instanceof AutomationError)) this.logger.error(`Automation run ${run.id} failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`);

    run.status = AutomationRunStatus.FAILED;
    run.finishedAt = new Date();
    run.errorCode = failure.code;
    run.errorMessage = failure.message.slice(0, 500);
    run.result = { durationMs: durationOf(run) };
    await this.runs.save(run);
    await this.audit.record({
      ...actorOf(requester), action: AuditAction.AUTOMATION_FAILED, entity: 'AutomationRun', entityId: run.id,
      metadata: { taxObligationId: run.taxObligationId, trigger: run.trigger, errorCode: run.errorCode },
    });
    if (obligation) {
      await this.notifications.notifyAutomationResult({
        runId: run.id,
        taxObligationId: obligation.id,
        userIds: [run.requestedById, obligation.responsibleUserId],
        title: 'Procesamiento fallido',
        message: `No se pudo procesar "${obligation.name}"${obligation.company ? ` de ${obligation.company.name}` : ''}: ${FAILURE_REASONS[failure.code]}`,
      });
    }
    this.logger.warn(`Automation run ${run.id} failed: ${run.errorCode}.`);
  }

  async listForObligation(taxObligationId: string): Promise<AutomationRunView[]> {
    if (!(await this.runs.manager.existsBy(TaxObligation, { id: taxObligationId }))) throw new NotFoundException('Tax obligation not found.');
    const runs = await this.runs.find({ where: { taxObligationId }, relations: { requestedBy: true }, order: { createdAt: 'DESC' }, take: 20 });
    return runs.map(toView);
  }

  async findOne(id: string): Promise<AutomationRunView> {
    const run = await this.runs.findOne({ where: { id }, relations: { requestedBy: true } });
    if (!run) throw new NotFoundException('Automation run not found.');
    return toView(run);
  }
}

function actorOf(requester: AuthUser | null): { actor: AuthUser | null; actorType: 'USER' | 'SYSTEM' } {
  return { actor: requester, actorType: requester ? 'USER' : 'SYSTEM' };
}

function durationOf(run: AutomationRun): number | undefined {
  return run.startedAt && run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : undefined;
}

function summarize(result: AutomationRunResult): string {
  const parts: string[] = [];
  if (result.overdueMarked) parts.push('se marcó como vencida');
  if (result.notificationsCreated) parts.push(`${result.notificationsCreated} alerta${result.notificationsCreated === 1 ? '' : 's'} de vencimiento enviada${result.notificationsCreated === 1 ? '' : 's'}`);
  if (result.withoutResponsible) parts.push('no tiene responsable asignado para recibir alertas');
  return parts.length ? `${parts.join(', ')}.` : 'sin cambios pendientes.';
}

function toView(run: AutomationRun): AutomationRunView {
  return {
    id: run.id,
    taxObligationId: run.taxObligationId,
    trigger: run.trigger,
    status: run.status,
    requestedBy: run.requestedBy ? { id: run.requestedBy.id, firstName: run.requestedBy.firstName, lastName: run.requestedBy.lastName } : null,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    result: run.result,
    createdAt: run.createdAt,
  };
}
