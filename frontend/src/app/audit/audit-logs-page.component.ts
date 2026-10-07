import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { AuditLogsApiService } from '../core/services/audit-logs-api.service';
import { UsersApiService } from '../core/services/users-api.service';
import { apiErrorMessage } from '../core/errors/api-error-message';
import { AuditAction, AuditLog } from '../shared/models/audit-log.model';
import { User } from '../shared/models/user.model';
import { AuditLogDetailDialogComponent } from './audit-log-detail-dialog.component';

const ACTIONS: AuditAction[] = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'UPLOAD', 'DOWNLOAD', 'MARK_READ', 'NOTIFICATION_CREATED'];
const ENTITIES = ['User', 'Company', 'Country', 'TaxObligation', 'Document', 'Notification'];

@Component({
  selector: 'app-audit-logs-page', standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, MatSelectModule, MatTableModule],
  template: `
    <header class="page-head"><div><p class="eyebrow">TRAZABILIDAD</p><h1>Audit Logs</h1><p class="intro">Historial inmutable de acciones relevantes de la plataforma.</p></div>
      <button mat-stroked-button type="button" (click)="load()" [disabled]="loading"><mat-icon>refresh</mat-icon> Actualizar</button></header>
    <form class="filters" [formGroup]="filters" (ngSubmit)="applyFilters()">
      <mat-form-field appearance="outline"><mat-label>Acción</mat-label><mat-select formControlName="action"><mat-option value="">Todas</mat-option><mat-option *ngFor="let action of actions" [value]="action">{{ action }}</mat-option></mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Tipo de recurso</mat-label><mat-select formControlName="entityType"><mat-option value="">Todos</mat-option><mat-option *ngFor="let entity of entities" [value]="entity">{{ entity }}</mat-option></mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Usuario</mat-label><mat-select formControlName="actor"><mat-option value="">Todos</mat-option><mat-option *ngFor="let user of users" [value]="user.id">{{ user.firstName }} {{ user.lastName }} · {{ user.email }}</mat-option></mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Desde</mat-label><input matInput type="date" formControlName="dateFrom"></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Hasta</mat-label><input matInput type="date" formControlName="dateTo"></mat-form-field>
      <div class="filter-actions"><button mat-flat-button color="primary" type="submit"><mat-icon>filter_alt</mat-icon> Filtrar</button><button mat-button type="button" (click)="clearFilters()">Limpiar filtros</button></div>
    </form>
    <section *ngIf="error" class="error" role="alert"><mat-icon>error_outline</mat-icon><span>{{ error }}</span><button mat-button type="button" (click)="load()">Reintentar</button></section>
    <mat-progress-bar *ngIf="loading" mode="indeterminate" />
    <div class="table-wrap"><table mat-table [dataSource]="rows" aria-label="Historial de auditoría">
      <ng-container matColumnDef="createdAt"><th mat-header-cell *matHeaderCellDef>Fecha y hora</th><td mat-cell *matCellDef="let row">{{ row.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}</td></ng-container>
      <ng-container matColumnDef="actor"><th mat-header-cell *matHeaderCellDef>Actor</th><td mat-cell *matCellDef="let row"><span class="actor" [class.system]="row.actorType === 'SYSTEM'">{{ actorName(row) }}</span></td></ng-container>
      <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef>Acción</th><td mat-cell *matCellDef="let row"><span class="action" [attr.data-action]="row.action">{{ row.action }}</span></td></ng-container>
      <ng-container matColumnDef="entity"><th mat-header-cell *matHeaderCellDef>Recurso</th><td mat-cell *matCellDef="let row">{{ row.entity }}</td></ng-container>
      <ng-container matColumnDef="entityId"><th mat-header-cell *matHeaderCellDef>ID recurso</th><td mat-cell *matCellDef="let row" class="resource-id">{{ row.entityId || '—' }}</td></ng-container>
      <ng-container matColumnDef="summary"><th mat-header-cell *matHeaderCellDef>Resumen</th><td mat-cell *matCellDef="let row" class="summary">{{ summary(row) }}</td></ng-container>
      <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let row"><button mat-icon-button type="button" aria-label="Ver detalle de auditoría" (click)="showDetail(row)"><mat-icon>visibility</mat-icon></button></td></ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr><tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
      <div *ngIf="!loading && !error && rows.length === 0" class="empty"><mat-icon>manage_search</mat-icon><strong>No hay registros de auditoría</strong><span>Probá otros filtros o volvé a consultar más tarde.</span></div>
    </div>
    <mat-paginator [length]="total" [pageIndex]="page - 1" [pageSize]="limit" [pageSizeOptions]="[10,20,50]" (page)="pageChanged($event)" aria-label="Paginación de auditoría" />
  `,
  styles: [`
    :host{display:block}.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:20px}.page-head h1{font-size:26px;color:#293b50;margin:0}.eyebrow{font-size:10px;color:#8290a0;font-weight:700;letter-spacing:.12em;margin:0 0 7px}.intro{font-size:13px;color:#7d8998;margin:8px 0 0}.filters{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:0 12px;padding:18px 18px 0;margin-bottom:16px;background:#fff;border:1px solid #e2e7ed;border-radius:9px}.filters mat-form-field{width:100%}.filter-actions{display:flex;align-items:flex-start;gap:8px;padding-top:3px;flex-wrap:wrap}.filter-actions mat-icon{font-size:18px;margin-right:4px}.table-wrap{overflow-x:auto;background:#fff;border:1px solid #e2e7ed;border-radius:9px}.table-wrap table{width:100%;min-width:1050px}.table-wrap th{font-size:10px;color:#8290a0;font-weight:650;background:#fafbfd}.table-wrap td{font-size:11px;color:#536276}.resource-id{font-family:Consolas,monospace;font-size:10px!important}.summary{max-width:280px;white-space:normal}.actor{font-size:11px}.actor.system{color:#7860a8;font-weight:700}.action{display:inline-flex;padding:3px 7px;border-radius:10px;background:#eef2f6;color:#566578;font-size:9px;font-weight:700;white-space:nowrap}.action[data-action="UPDATE"]{background:#e9f2fc;color:#28669e}.action[data-action="DELETE"]{background:#fcebea;color:#a2423a}.action[data-action="UPLOAD"]{background:#eaf5ef;color:#2d7853}.action[data-action="LOGIN"]{background:#eff1fb;color:#5b63a0}.error{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:13px;border:1px solid #edcccc;border-radius:8px;background:#fffafa;color:#873f3f;font-size:12px}.error button{margin-left:auto}.empty{min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#8b97a5;font-size:12px}.empty mat-icon{font-size:28px;width:28px;height:28px}.empty strong{color:#536477;font-size:14px}mat-paginator{margin-top:6px;background:transparent}
    @media(max-width:850px){.filters{grid-template-columns:repeat(2,minmax(140px,1fr))}.filter-actions{padding-bottom:18px}}
    @media(max-width:600px){.page-head{align-items:flex-start;flex-direction:column}.filters{grid-template-columns:1fr;padding:14px 12px 0}.filter-actions{padding-bottom:14px}.page-head h1{font-size:23px}}
  `],
})
export class AuditLogsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AuditLogsApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly actions = ACTIONS;
  readonly entities = ENTITIES;
  readonly columns = ['createdAt', 'actor', 'action', 'entity', 'entityId', 'summary', 'actions'];
  readonly filters = this.fb.nonNullable.group({ action: '', entityType: '', actor: '', dateFrom: '', dateTo: '' });
  rows: AuditLog[] = [];
  users: User[] = [];
  total = 0;
  page = 1;
  limit = 20;
  loading = false;
  error = '';

  constructor() {
    this.load();
    this.usersApi.list(1, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (result) => this.users = result.data });
  }

  load(): void {
    this.loading = true; this.error = '';
    this.api.list({ ...this.filters.getRawValue(), page: this.page, limit: this.limit, action: (this.filters.controls.action.value || undefined) as AuditAction | undefined, entityType: this.filters.controls.entityType.value || undefined, actor: this.filters.controls.actor.value || undefined, dateFrom: this.filters.controls.dateFrom.value || undefined, dateTo: this.filters.controls.dateTo.value || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (response) => { this.rows = response.data; this.total = response.meta.total; this.loading = false; },
        error: (error: unknown) => { this.error = apiErrorMessage(error, 'No se pudo cargar el historial de auditoría.'); this.loading = false; },
      });
  }

  applyFilters(): void { this.page = 1; this.load(); }
  clearFilters(): void { this.filters.reset({ action: '', entityType: '', actor: '', dateFrom: '', dateTo: '' }); this.page = 1; this.load(); }
  pageChanged(event: PageEvent): void { this.page = event.pageIndex + 1; this.limit = event.pageSize; this.load(); }
  actorName(row: AuditLog): string { return row.actorType === 'SYSTEM' ? 'SYSTEM' : row.actorEmail ?? row.actor?.email ?? 'Usuario eliminado'; }
  showDetail(row: AuditLog): void { this.dialog.open(AuditLogDetailDialogComponent, { data: row, width: '680px', maxWidth: '94vw' }); }

  summary(row: AuditLog): string {
    const metadata = row.metadata ?? {};
    const changes = metadata['changes'];
    if (changes && typeof changes === 'object') {
      const fields = Object.entries(changes as Record<string, { before?: unknown; after?: unknown }>);
      if (fields.length) return fields.slice(0, 2).map(([field, change]) => `${field}: ${String(change.before ?? '—')} → ${String(change.after ?? '—')}`).join(' · ') + (fields.length > 2 ? ` · +${fields.length - 2}` : '');
    }
    const values = metadata['values'];
    if (values && typeof values === 'object') return Object.entries(values as Record<string, unknown>).slice(0, 2).map(([key, value]) => `${key}: ${String(value ?? '—')}`).join(' · ');
    return String(metadata['originalFilename'] ?? metadata['title'] ?? metadata['role'] ?? '—');
  }
}
