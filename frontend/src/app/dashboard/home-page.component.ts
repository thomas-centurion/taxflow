import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, map, of, startWith, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../core/auth/auth.service';
import { DashboardDataService } from './dashboard-data.service';
import { TaxObligation, TaxObligationStatus } from '../shared/models/tax-obligation.model';

const STATUSES: TaxObligationStatus[] = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'OVERDUE', 'CANCELLED'];
const STATUS_LABELS: Record<TaxObligationStatus, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', SUBMITTED: 'Presentada',
  APPROVED: 'Aprobada', OVERDUE: 'Vencida', CANCELLED: 'Cancelada',
};
const STATUS_COLORS: Record<TaxObligationStatus, string> = {
  PENDING: '#d99a20', IN_PROGRESS: '#3478bd', SUBMITTED: '#7456b8',
  APPROVED: '#318767', OVERDUE: '#c44949', CANCELLED: '#8592a2',
};

interface DashboardState {
  loading: boolean;
  error: boolean;
  data?: {
    obligations: TaxObligation[];
    totalCompanies: number;
    counts: Record<TaxObligationStatus, number>;
    overdue: TaxObligation[];
    upcoming: TaxObligation[];
    statusRows: { status: TaxObligationStatus; label: string; count: number; percent: number; color: string }[];
    companyRows: { name: string; pending: number; overdue: number }[];
  };
}

@Component({
  selector: 'app-home-page', standalone: true,
  imports: [AsyncPipe, CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  template: `
    <ng-container *ngIf="state$ | async as state">
      <header class="dashboard-header">
        <div><p class="eyebrow">RESUMEN FISCAL</p><h1>Dashboard</h1>
          <p class="intro" *ngIf="auth.currentUser as user">Hola, {{ user.firstName }}. Estado actual de tus obligaciones fiscales.</p>
        </div>
        <button mat-stroked-button type="button" (click)="refresh()" [disabled]="state.loading" aria-label="Actualizar dashboard">
          <mat-icon>refresh</mat-icon> Actualizar
        </button>
      </header>

      <mat-progress-bar *ngIf="state.loading" mode="indeterminate" aria-label="Cargando dashboard" />
      <section *ngIf="state.loading" class="loading-placeholder" aria-label="Cargando métricas">
        <div class="skeleton-metrics"><mat-card *ngFor="let item of [1,2,3,4,5,6]" class="skeleton-card"><mat-card-content><span></span><strong></strong><small></small></mat-card-content></mat-card></div>
        <div class="skeleton-panels"><div class="skeleton-panel"></div><div class="skeleton-panel"></div></div>
      </section>

      <section *ngIf="state.error" class="error-panel" role="alert">
        <mat-icon>error_outline</mat-icon><div><strong>No se pudo cargar el dashboard.</strong><p>Revisá la conexión e intentá nuevamente.</p></div>
        <button mat-flat-button color="primary" type="button" (click)="refresh()">Reintentar</button>
      </section>

      <ng-container *ngIf="state.data as data">
        <section class="metrics" aria-label="Métricas de obligaciones">
          <mat-card class="metric-card"><mat-card-content><span>Total de obligaciones</span><strong>{{ data.obligations.length }}</strong><small>En todos los registros</small></mat-card-content></mat-card>
          <mat-card class="metric-card"><mat-card-content><span>Pendientes</span><strong>{{ data.counts.PENDING }}</strong><small>Estado registrado</small></mat-card-content></mat-card>
          <mat-card class="metric-card"><mat-card-content><span>En progreso</span><strong>{{ data.counts.IN_PROGRESS }}</strong><small>Estado registrado</small></mat-card-content></mat-card>
          <mat-card class="metric-card"><mat-card-content><span>Presentadas</span><strong>{{ data.counts.SUBMITTED }}</strong><small>Estado registrado</small></mat-card-content></mat-card>
          <mat-card class="metric-card"><mat-card-content><span>Aprobadas</span><strong>{{ data.counts.APPROVED }}</strong><small>Estado registrado</small></mat-card-content></mat-card>
          <mat-card class="metric-card" [class.attention-card]="data.overdue.length > 0"><mat-card-content><span>Vencidas</span><strong>{{ data.overdue.length }}</strong><small>Según fecha y estado</small></mat-card-content></mat-card>
        </section>

        <section class="attention-strip" aria-label="Atención requerida">
          <mat-icon>priority_high</mat-icon><strong>Atención requerida</strong>
          <a routerLink="/app/tax-obligations">{{ data.overdue.length }} vencidas</a>
          <span class="divider"></span>
          <a routerLink="/app/tax-obligations">{{ data.upcoming.length }} próximos vencimientos</a>
        </section>

        <div class="content-grid">
          <mat-card class="panel">
            <mat-card-header><mat-card-title>Próximos vencimientos</mat-card-title><a mat-button routerLink="/app/tax-obligations">Ver todas</a></mat-card-header>
            <mat-card-content>
              <div class="table-scroll" *ngIf="data.upcoming.length; else noUpcoming">
                <table><thead><tr><th>Obligación</th><th>Empresa</th><th>Tipo</th><th>Vencimiento</th><th>Estado</th><th>Responsable</th></tr></thead>
                  <tbody><tr *ngFor="let obligation of data.upcoming">
                    <td><strong>{{ obligation.name }}</strong></td><td>{{ obligation.company.name }}</td><td>{{ typeLabel(obligation.type) }}</td>
                    <td>{{ formatDate(obligation.dueDate) }}</td><td><span class="status" [attr.data-status]="obligation.status">{{ statusLabel(obligation.status) }}</span></td>
                    <td>{{ responsibleName(obligation) }}</td>
                  </tr></tbody>
                </table>
              </div>
              <ng-template #noUpcoming><div class="empty-state"><mat-icon>event_available</mat-icon><p>No hay vencimientos próximos en los siguientes 30 días.</p></div></ng-template>
            </mat-card-content>
          </mat-card>

          <mat-card class="panel">
            <mat-card-header><mat-card-title>Obligaciones vencidas</mat-card-title><a mat-button routerLink="/app/tax-obligations">Ver todas</a></mat-card-header>
            <mat-card-content>
              <div class="table-scroll" *ngIf="data.overdue.length; else noOverdue">
                <table><thead><tr><th>Obligación</th><th>Empresa</th><th>Vencimiento</th><th>Estado</th></tr></thead>
                  <tbody><tr *ngFor="let obligation of data.overdue.slice(0, 5)"><td><strong>{{ obligation.name }}</strong></td><td>{{ obligation.company.name }}</td>
                    <td>{{ formatDate(obligation.dueDate) }}</td><td><span class="status" data-status="OVERDUE">Vencida</span></td></tr></tbody>
                </table>
              </div>
              <ng-template #noOverdue><div class="empty-state"><mat-icon>task_alt</mat-icon><p>No hay obligaciones vencidas.</p></div></ng-template>
            </mat-card-content>
          </mat-card>

          <mat-card class="panel">
            <mat-card-header><mat-card-title>Distribución por estado</mat-card-title><span class="panel-note">Estado registrado en la API</span></mat-card-header>
            <mat-card-content>
              <div class="distribution" *ngIf="data.obligations.length; else noDistribution">
                <div class="distribution-row" *ngFor="let row of data.statusRows">
                  <div class="distribution-label"><span class="legend-dot" [style.backgroundColor]="row.color"></span><span>{{ row.label }}</span><strong>{{ row.count }}</strong></div>
                  <div class="bar-track" role="progressbar" [attr.aria-label]="row.label" [attr.aria-valuenow]="row.count" [attr.aria-valuemax]="data.obligations.length" aria-valuemin="0"><span [style.width.%]="row.percent" [style.backgroundColor]="row.color"></span></div>
                </div>
              </div>
              <ng-template #noDistribution><div class="empty-state"><mat-icon>bar_chart</mat-icon><p>Sin obligaciones para mostrar.</p></div></ng-template>
            </mat-card-content>
          </mat-card>

          <mat-card class="panel">
            <mat-card-header><mat-card-title>Empresas</mat-card-title><a mat-button routerLink="/app/companies">Ver empresas</a></mat-card-header>
            <mat-card-content>
              <div class="company-total"><strong>{{ data.totalCompanies }}</strong><span>empresas registradas</span></div>
              <div class="table-scroll" *ngIf="data.companyRows.length; else noCompanies">
                <table><thead><tr><th>Empresa</th><th>Pendientes</th><th>Vencidas</th></tr></thead><tbody>
                  <tr *ngFor="let company of data.companyRows"><td>{{ company.name }}</td><td>{{ company.pending }}</td><td>{{ company.overdue }}</td></tr>
                </tbody></table>
              </div>
              <ng-template #noCompanies><div class="empty-state compact"><p>No hay empresas con obligaciones pendientes o vencidas.</p></div></ng-template>
            </mat-card-content>
          </mat-card>
        </div>
      </ng-container>
    </ng-container>
  `,
  styles: [`
    :host{display:block;color:#243448}.dashboard-header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 22px}.eyebrow{color:#718197;font-size:10px;font-weight:700;letter-spacing:.13em;margin:0 0 6px}.dashboard-header h1{font-size:28px;letter-spacing:-.03em;margin:0;color:#203249}.intro{color:#657488;margin:7px 0 0;font-size:13px}.dashboard-header button{white-space:nowrap}.dashboard-header mat-icon{font-size:18px;width:18px;height:18px;margin-right:4px}
    .metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin:18px 0}.metric-card,.panel{border:1px solid #e2e8ef;box-shadow:none!important;border-radius:10px!important}.metric-card mat-card-content{padding:17px 16px;display:flex;flex-direction:column;gap:7px}.metric-card span{color:#66768a;font-size:12px;font-weight:600}.metric-card strong{font-size:27px;line-height:1.1;color:#23364e}.metric-card small{color:#8995a3;font-size:11px}.attention-card strong{color:#b74040}
    .attention-strip{min-height:52px;display:flex;align-items:center;gap:12px;padding:10px 16px;margin-bottom:18px;border:1px solid #f0d8d8;border-radius:9px;background:#fffafa;color:#6d4141;font-size:13px}.attention-strip mat-icon{color:#b74040}.attention-strip a{color:#2865aa;text-decoration:none;font-weight:600}.divider{height:20px;border-left:1px solid #e5cccc}.content-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,1fr);gap:16px}.panel mat-card-header{min-height:58px;align-items:center;padding:4px 16px 0}.panel mat-card-title{font-size:15px!important;font-weight:650!important;color:#2a3d54}.panel mat-card-header a{margin-left:auto;font-size:12px}.panel-note{margin-left:auto;color:#8491a1;font-size:11px}.panel mat-card-content{padding:0 16px 16px}
    .table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:12px;white-space:nowrap}th{text-align:left;color:#8793a1;font-size:10px;font-weight:650;padding:9px 10px;border-bottom:1px solid #e8edf2}td{padding:11px 10px;border-bottom:1px solid #edf0f4;color:#536276}td strong{color:#2d4057;font-weight:600}tbody tr:last-child td{border-bottom:0}.status{display:inline-block;border-radius:20px;padding:4px 8px;font-size:10px;font-weight:650;background:#eef2f5;color:#687687}.status[data-status="PENDING"]{background:#fff5df;color:#96690d}.status[data-status="IN_PROGRESS"]{background:#e8f2fc;color:#28669e}.status[data-status="SUBMITTED"]{background:#f1ecfb;color:#6949a3}.status[data-status="APPROVED"]{background:#e8f5ee;color:#287452}.status[data-status="OVERDUE"]{background:#fceaea;color:#ad3f3f}.status[data-status="CANCELLED"]{background:#eef0f2;color:#697583}
    .empty-state{min-height:125px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#8491a1;font-size:12px;gap:8px}.empty-state mat-icon{color:#8ca0b5}.empty-state p{margin:0}.empty-state.compact{min-height:76px}.distribution{padding-top:8px}.distribution-row{margin:0 0 17px}.distribution-label{display:flex;align-items:center;gap:8px;font-size:12px;color:#57687b;margin-bottom:7px}.distribution-label strong{margin-left:auto;color:#2d4057}.legend-dot{width:9px;height:9px;border-radius:50%}.bar-track{height:7px;background:#eff2f5;border-radius:8px;overflow:hidden}.bar-track span{display:block;height:100%;min-width:0;border-radius:8px}.company-total{display:flex;align-items:baseline;gap:9px;padding:8px 10px 14px}.company-total strong{font-size:25px;color:#263b53}.company-total span{font-size:12px;color:#798697}.error-panel{display:flex;align-items:center;gap:14px;padding:20px;border:1px solid #edcccc;border-radius:9px;background:#fffafa;color:#783d3d}.error-panel>mat-icon{color:#bd4949}.error-panel p{margin:5px 0 0;font-size:12px;color:#886666}.error-panel button{margin-left:auto}
    .loading-placeholder{padding-top:16px}.skeleton-metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.skeleton-card,.skeleton-panel{border:1px solid #e2e8ef;box-shadow:none!important;border-radius:10px!important}.skeleton-card mat-card-content{padding:17px 16px;display:grid;gap:10px}.skeleton-card span,.skeleton-card strong,.skeleton-card small{height:10px;border-radius:5px;background:#edf1f5}.skeleton-card strong{height:25px;width:45%}.skeleton-card small{width:72%}.skeleton-panels{display:grid;grid-template-columns:1.55fr 1fr;gap:16px;margin-top:16px}.skeleton-panel{height:200px;background:linear-gradient(180deg,#fff 0 30%,#f8fafb 30% 100%)}
    @media(max-width:1100px){.metrics,.skeleton-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.content-grid,.skeleton-panels{grid-template-columns:1fr}}
    @media(max-width:600px){.dashboard-header{align-items:flex-start}.dashboard-header h1{font-size:24px}.dashboard-header button{padding:0 10px}.metrics,.skeleton-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.metric-card mat-card-content,.skeleton-card mat-card-content{padding:14px 12px}.metric-card strong{font-size:24px}.attention-strip{flex-wrap:wrap;gap:8px;font-size:12px}.attention-strip strong{flex:1}.attention-strip .divider{display:none}.panel mat-card-header{padding-left:12px;padding-right:8px}.panel mat-card-content{padding-left:8px;padding-right:8px}.error-panel{align-items:flex-start;flex-wrap:wrap}.error-panel button{margin:4px 0 0 34px}}
  `],
})
export class HomePageComponent {
  readonly auth = inject(AuthService);
  private readonly dataService = inject(DashboardDataService);
  private readonly refreshSubject = new BehaviorSubject<void>(undefined);
  readonly state$ = this.refreshSubject.pipe(
    switchMap(() => this.dataService.load().pipe(
      map((raw) => ({ loading: false, error: false, data: this.buildDashboard(raw.companies, raw.obligations) } as DashboardState)),
      catchError(() => of({ loading: false, error: true } as DashboardState)),
      startWith({ loading: true, error: false } as DashboardState),
    )),
  );

  refresh(): void { this.refreshSubject.next(); }
  statusLabel(status: TaxObligationStatus): string { return STATUS_LABELS[status]; }
  typeLabel(type: string): string { return ({ VAT: 'IVA', INCOME_TAX: 'Ganancias', WITHHOLDING: 'Retenciones', PAYROLL_TAX: 'Impuestos nómina', OTHER: 'Otro' } as Record<string, string>)[type] ?? type; }
  responsibleName(obligation: TaxObligation): string {
    const user = obligation.responsibleUser;
    return user ? `${user.firstName} ${user.lastName}` : 'Sin asignar';
  }
  formatDate(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private buildDashboard(companies: { id: string; name: string }[], obligations: TaxObligation[]): NonNullable<DashboardState['data']> {
    const today = this.dateKey(new Date());
    const inThirtyDays = this.addDays(today, 30);
    const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<TaxObligationStatus, number>;
    for (const obligation of obligations) counts[obligation.status] += 1;

    // Overdue state comes from the backend business rule; the frontend does not redefine it.
    const overdue = obligations.filter((obligation) => obligation.isOverdue)
      .sort((a, b) => this.dueDateKey(a.dueDate).localeCompare(this.dueDateKey(b.dueDate)));
    const upcoming = obligations.filter((obligation) => !obligation.isOverdue && ['PENDING', 'IN_PROGRESS'].includes(obligation.status) &&
      this.dueDateKey(obligation.dueDate) >= today && this.dueDateKey(obligation.dueDate) <= inThirtyDays)
      .sort((a, b) => this.dueDateKey(a.dueDate).localeCompare(this.dueDateKey(b.dueDate))).slice(0, 5);
    const total = obligations.length;
    const statusRows = STATUSES.map((status) => ({
      status, label: STATUS_LABELS[status], count: counts[status],
      percent: total ? counts[status] / total * 100 : 0, color: STATUS_COLORS[status],
    }));
    const companyMetrics = new Map<string, { name: string; pending: number; overdue: number }>();
    for (const company of companies) companyMetrics.set(company.id, { name: company.name, pending: 0, overdue: 0 });
    for (const obligation of obligations) {
      const row = companyMetrics.get(obligation.companyId);
      if (!row) continue;
      if (obligation.status === 'PENDING') row.pending += 1;
      if (obligation.isOverdue) row.overdue += 1;
    }
    const companyRows = [...companyMetrics.values()].filter((row) => row.pending || row.overdue)
      .sort((a, b) => b.overdue - a.overdue || b.pending - a.pending || a.name.localeCompare(b.name)).slice(0, 5);
    return { obligations, totalCompanies: companies.length, counts, overdue, upcoming, statusRows, companyRows };
  }

  private dueDateKey(value: string): string { return value.slice(0, 10); }
  private dateKey(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  private addDays(dateKey: string, days: number): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    const result = new Date(year, month - 1, day + days);
    return this.dateKey(result);
  }
}
