import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../core/errors/api-error-message';
import { AuditLogsApiService } from '../../core/services/audit-logs-api.service';
import { UsersApiService } from '../../core/services/users-api.service';
import { AuditAction, AuditLog } from '../../shared/models/audit-log.model';
import { User } from '../../shared/models/user.model';
import { AUDIT_ACTION, AUDIT_ACTION_OPTIONS, AUDIT_ENTITY_OPTIONS, entityLabel } from '../../shared/presentation/labels';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent } from '../../shared/ui/states.component';
import { AuditLogDetailDialogComponent } from '../audit-log-detail-dialog/audit-log-detail-dialog.component';
import { auditActor, auditSummary } from '../audit-format';

@Component({
  selector: 'app-audit-logs-page',
  imports: [DatePipe, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, MatSelectModule, MatTableModule, MatTooltipModule, EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent, PageHeaderComponent],
  templateUrl: './audit-logs-page.component.html',
  styleUrl: './audit-logs-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogsPageComponent {
  private readonly api = inject(AuditLogsApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly actionOptions = AUDIT_ACTION_OPTIONS;
  readonly entityOptions = AUDIT_ENTITY_OPTIONS;
  readonly entityLabel = entityLabel;
  readonly actor = auditActor;
  readonly summary = auditSummary;
  readonly columns = ['createdAt', 'actor', 'action', 'entity', 'summary', 'open'];
  readonly filters = inject(FormBuilder).nonNullable.group({ action: '', entityType: '', actor: '', dateFrom: '', dateTo: '' });

  readonly rows = signal<AuditLog[]>([]);
  readonly users = signal<User[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly rangeError = signal(false);
  readonly activeFilters = signal(0);
  private readonly trigger$ = new BehaviorSubject<void>(undefined);

  constructor() {
    this.usersApi.list(1, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (result) => this.users.set(result.data), error: () => undefined });

    this.trigger$.pipe(
      tap(() => { this.loading.set(true); this.error.set(''); }),
      switchMap(() => {
        const value = this.filters.getRawValue();
        return this.api.list({
          page: this.pageIndex() + 1,
          limit: this.pageSize(),
          action: (value.action || undefined) as AuditAction | undefined,
          entityType: value.entityType || undefined,
          actor: value.actor || undefined,
          dateFrom: value.dateFrom || undefined,
          dateTo: value.dateTo || undefined,
        }).pipe(catchError((error: unknown) => { this.error.set(apiErrorMessage(error, 'No se pudo cargar el historial de auditoría.')); return of(null); }));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((response) => {
      this.loading.set(false);
      if (!response) return;
      this.rows.set(response.data);
      this.total.set(response.meta.total);
    });

    this.filters.valueChanges.pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.activeFilters.set(Object.values(value).filter(Boolean).length);
      // Inverted ranges are rejected by the API; explain it here instead of sending the request.
      const inverted = !!value.dateFrom && !!value.dateTo && value.dateFrom > value.dateTo;
      this.rangeError.set(inverted);
      if (inverted) return;
      this.pageIndex.set(0);
      this.trigger$.next();
    });
  }

  reload(): void { this.trigger$.next(); }
  clearFilters(): void { this.filters.reset(); }

  changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.trigger$.next();
  }

  actionMeta(row: AuditLog): { label: string; tone: string } { return AUDIT_ACTION[row.action] ?? { label: row.action, tone: 'neutral' }; }

  showDetail(row: AuditLog): void {
    this.dialog.open(AuditLogDetailDialogComponent, { data: row, width: '680px', maxWidth: '96vw', autoFocus: 'dialog', restoreFocus: true });
  }
}
