import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../core/errors/api-error-message';
import { FeedbackService } from '../../core/feedback/feedback.service';
import { AutomationRunsApiService } from '../../core/services/automation-runs-api.service';
import { AutomationRun } from '../../shared/models/automation-run.model';
import { TaxObligation, TaxObligationStatus } from '../../shared/models/tax-obligation.model';
import { personName } from '../../shared/presentation/format';
import { AUTOMATION_ERROR_LABELS, AUTOMATION_RUN_STATUS, AUTOMATION_TRIGGER_LABELS, statusLabel } from '../../shared/presentation/labels';

/** Mirrors the backend rule to explain upfront why the action is unavailable; the API remains authoritative. */
const PROCESSABLE: TaxObligationStatus[] = ['PENDING', 'IN_PROGRESS', 'OVERDUE'];

/**
 * Automated deadline processing of one obligation: run it now and review previous runs (manual and
 * scheduled). Emits `changed` when a run modified the obligation so the page can refresh it.
 */
@Component({
  selector: 'app-obligation-automation-panel',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
  templateUrl: './obligation-automation-panel.component.html',
  styleUrl: './obligation-automation-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObligationAutomationPanelComponent {
  private readonly api = inject(AutomationRunsApiService);
  private readonly feedback = inject(FeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  readonly obligation = input.required<TaxObligation>();
  readonly canManage = input(false);
  readonly changed = output<AutomationRun>();

  readonly runStatus = AUTOMATION_RUN_STATUS;
  readonly triggerLabels = AUTOMATION_TRIGGER_LABELS;
  readonly errorLabels = AUTOMATION_ERROR_LABELS;
  readonly personName = personName;

  readonly runs = signal<AutomationRun[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly processing = signal(false);

  readonly latest = computed<AutomationRun | null>(() => this.runs()[0] ?? null);
  readonly blockReason = computed(() => {
    const status = this.obligation().status;
    return PROCESSABLE.includes(status) ? '' : `Solo se procesan obligaciones pendientes, en curso o vencidas. Estado actual: ${statusLabel(status)}.`;
  });
  readonly canRun = computed(() => this.canManage() && !this.blockReason() && !this.processing());

  private readonly obligationId = computed(() => this.obligation().id);

  constructor() {
    toObservable(this.obligationId).pipe(
      tap(() => { this.loading.set(true); this.error.set(''); }),
      switchMap((id) => this.api.listForObligation(id).pipe(
        catchError((error: unknown) => { this.error.set(apiErrorMessage(error, 'No se pudo cargar el historial de ejecuciones.')); return of(null); }),
        finalize(() => this.loading.set(false)),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((runs) => { if (runs) this.runs.set(runs); });
  }

  run(): void {
    this.processing.set(true);
    this.api.run(this.obligation().id).pipe(
      finalize(() => this.processing.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (run) => {
        this.runs.update((runs) => [run, ...runs]);
        if (run.status === 'SUCCEEDED') this.feedback.success(`Procesamiento completado: ${this.summary(run)}`);
        else this.feedback.error(`El procesamiento falló: ${run.errorCode ? this.errorLabels[run.errorCode] : 'error desconocido.'}`);
        if (run.result?.previousStatus !== run.result?.status) this.changed.emit(run);
      },
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudo procesar la obligación.'),
    });
  }

  /** One-line outcome of a successful run. */
  summary(run: AutomationRun): string {
    const result = run.result;
    if (!result) return '—';
    const parts: string[] = [];
    if (result.overdueMarked) parts.push('marcada como vencida');
    if (result.notificationsCreated) parts.push(`${result.notificationsCreated} alerta${result.notificationsCreated === 1 ? '' : 's'} enviada${result.notificationsCreated === 1 ? '' : 's'}`);
    if (result.withoutResponsible) parts.push('sin responsable para alertas');
    return parts.length ? parts.join(' · ') : 'sin cambios';
  }

  duration(run: AutomationRun): string {
    const ms = run.result?.durationMs;
    return ms === undefined ? '—' : `${ms} ms`;
  }
}
