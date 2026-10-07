import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { EMPTY, catchError, filter, forkJoin, switchMap } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { apiErrorMessage } from '../core/errors/api-error-message';
import { CompaniesApiService } from '../core/services/companies-api.service';
import { CountriesApiService } from '../core/services/countries-api.service';
import { NotificationsApiService } from '../core/services/notifications-api.service';
import { TaxObligationsApiService } from '../core/services/tax-obligations-api.service';
import { UsersApiService } from '../core/services/users-api.service';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog.component';
import { EditorDialogComponent, EditorResult } from '../shared/components/editor-dialog.component';
import { Company } from '../shared/models/company.model';
import { Country } from '../shared/models/country.model';
import { TaxObligation, TaxObligationInput, TaxObligationStatus, TaxObligationType } from '../shared/models/tax-obligation.model';
import { UserOption } from '../shared/models/user.model';


const OBLIGATION_STYLES = `:host{display:block}.page-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 22px}.eyebrow{margin:0 0 6px;color:#7b899a;font-size:10px;font-weight:700;letter-spacing:.13em}.page-head h1{margin:0;color:#1e3045;font-size:27px;letter-spacing:-.025em}.subtitle{margin:7px 0 0;color:#6b7a8d;font-size:13px}.page-head button{height:42px}.page-head button mat-icon{margin-right:5px}.panel{background:#fff;border:1px solid #e2e7ed;border-radius:10px;overflow:hidden}.filters{display:grid;grid-template-columns:repeat(3,minmax(130px,1fr));gap:0 12px;padding:18px 20px 0;border-bottom:1px solid #edf0f3}.filters mat-form-field{width:100%}.filters button{height:46px;margin:1px 0 22px;align-self:start}.filters button mat-icon{margin-right:4px}.table-scroll{overflow-x:auto}.data-table{width:100%;min-width:1040px}.data-table th{font-size:11px;color:#718094;font-weight:600;background:#fbfcfd}.data-table td{font-size:12px;color:#3c4b5e}.data-table td strong{color:#24364b;font-weight:600}.actions-head{text-align:right;padding-right:26px}.actions{text-align:right;white-space:nowrap}.actions button{width:36px;height:36px}.actions mat-icon{font-size:19px}.status{display:inline-flex;padding:4px 9px;border-radius:20px;background:#f2f4f6;color:#596a7d;font-size:10px;white-space:nowrap}.status.pending{background:#fff4df;color:#9a6818}.status.in_progress{background:#e9f1fc;color:#33649c}.status.submitted{background:#e9f5f3;color:#28736a}.status.approved{background:#e8f5ed;color:#26734b}.status.overdue{background:#ffebe9;color:#aa4037}.status.cancelled{background:#f1f2f4;color:#747e89}.loading-state,.empty-state{min-height:190px;display:flex;align-items:center;justify-content:center;gap:12px;color:#6c7a8c;font-size:13px}.empty-state{flex-direction:column;gap:7px}.empty-state strong{color:#36485d}.error-state{padding:18px;display:flex;align-items:center;gap:9px;color:#ac4136;background:#fff4f2;font-size:13px}.error-state button{margin-left:auto}.mat-mdc-paginator{border-top:1px solid #edf0f3}@media(max-width:850px){.filters{grid-template-columns:repeat(2,minmax(130px,1fr))}}@media(max-width:600px){.page-head{align-items:flex-start;flex-direction:column}.filters{grid-template-columns:1fr;padding:14px 12px 0}.filters button{margin-bottom:10px}}`;

@Component({
  selector: 'app-tax-obligations-page', standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatProgressSpinnerModule, MatSelectModule, MatTableModule],
  template: `
    <header class="page-head"><div><p class="eyebrow">CUMPLIMIENTO</p><h1>Obligaciones fiscales</h1><p class="subtitle">Seguimiento de presentaciones, responsables y vencimientos.</p></div>@if (canWrite) { <button mat-flat-button color="primary" (click)="openEditor()"><mat-icon>add</mat-icon> Nueva obligación</button> }</header>
    <section class="panel">
      <form class="filters" [formGroup]="filters" (ngSubmit)="applyFilters()">
        <mat-form-field appearance="outline"><mat-label>Empresa</mat-label><mat-select formControlName="company"><mat-option value="">Todas</mat-option><mat-option *ngFor="let item of companies" [value]="item.id">{{ item.name }}</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>País</mat-label><mat-select formControlName="country"><mat-option value="">Todos</mat-option><mat-option *ngFor="let item of countries" [value]="item.id">{{ item.name }}</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Estado</mat-label><mat-select formControlName="status"><mat-option value="">Todos</mat-option><mat-option *ngFor="let item of statuses" [value]="item.value">{{ item.label }}</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Tipo</mat-label><mat-select formControlName="type"><mat-option value="">Todos</mat-option><mat-option *ngFor="let item of types" [value]="item.value">{{ item.label }}</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Responsable</mat-label><mat-select formControlName="responsibleUser"><mat-option value="">Todos</mat-option><mat-option *ngFor="let item of users" [value]="item.id">{{ item.firstName }} {{ item.lastName }}</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Vencimiento</mat-label><input matInput type="date" formControlName="dueDate"></mat-form-field>
        <button mat-stroked-button type="submit"><mat-icon>filter_alt</mat-icon> Aplicar</button><button mat-button type="button" (click)="clearFilters()">Limpiar</button>
      </form>
      @if (errorMessage) { <div class="error-state" role="alert"><mat-icon>error_outline</mat-icon>{{ errorMessage }} <button mat-button (click)="load()">Reintentar</button></div> }
      @if (loading) { <div class="loading-state"><mat-spinner diameter="32"></mat-spinner><span>Cargando obligaciones...</span></div> }
      @if (!loading && !errorMessage && rows.length === 0) { <div class="empty-state"><mat-icon>assignment</mat-icon><strong>No se encontraron obligaciones.</strong><span>Probá cambiar los filtros.</span></div> }
      @if (!loading && rows.length > 0) { <div class="table-scroll"><table mat-table [dataSource]="rows" class="data-table">
        <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Obligación</th><td mat-cell *matCellDef="let row"><a class="obligation-link" [routerLink]="['/app/tax-obligations', row.id]"><strong>{{ row.name }}</strong></a></td></ng-container>
        <ng-container matColumnDef="company"><th mat-header-cell *matHeaderCellDef>Empresa</th><td mat-cell *matCellDef="let row">{{ row.company?.name || '—' }}</td></ng-container>
        <ng-container matColumnDef="country"><th mat-header-cell *matHeaderCellDef>País</th><td mat-cell *matCellDef="let row">{{ row.country?.name || '—' }}</td></ng-container>
        <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef>Tipo</th><td mat-cell *matCellDef="let row">{{ typeLabel(row.type) }}</td></ng-container>
        <ng-container matColumnDef="dueDate"><th mat-header-cell *matHeaderCellDef>Vencimiento</th><td mat-cell *matCellDef="let row">{{ row.dueDate | date:'dd/MM/yyyy':'UTC' }}</td></ng-container>
        <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let row"><span class="status" [class]="'status ' + row.status.toLowerCase()">{{ statusLabel(row.status) }}</span></td></ng-container>
        <ng-container matColumnDef="responsible"><th mat-header-cell *matHeaderCellDef>Responsable</th><td mat-cell *matCellDef="let row">{{ row.responsibleUser ? row.responsibleUser.firstName + ' ' + row.responsibleUser.lastName : 'Sin asignar' }}</td></ng-container>
        <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef class="actions-head">Acciones</th><td mat-cell *matCellDef="let row" class="actions">@if (canWrite) { <button mat-icon-button aria-label="Editar obligación" (click)="openEditor(row)"><mat-icon>edit</mat-icon></button><button mat-icon-button color="warn" aria-label="Eliminar obligación" (click)="confirmDelete(row)"><mat-icon>delete_outline</mat-icon></button> }</td></ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr><tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table></div><mat-paginator [length]="total" [pageIndex]="pageIndex" [pageSize]="pageSize" [pageSizeOptions]="[10, 20, 50]" (page)="changePage($event)" aria-label="Paginación de obligaciones"></mat-paginator> }
    </section>
  `,
  styles: [OBLIGATION_STYLES + `.obligation-link{color:inherit;text-decoration:none}.obligation-link:hover{text-decoration:underline;color:#2865aa}`],
})
export class TaxObligationsPageComponent {
  private readonly fb = inject(FormBuilder); private readonly api = inject(TaxObligationsApiService); private readonly notificationsApi = inject(NotificationsApiService); private readonly companiesApi = inject(CompaniesApiService); private readonly countriesApi = inject(CountriesApiService); private readonly usersApi = inject(UsersApiService); private readonly auth = inject(AuthService); private readonly dialog = inject(MatDialog); private readonly snack = inject(MatSnackBar); private readonly destroyRef = inject(DestroyRef);
  readonly columns = ['name', 'company', 'country', 'type', 'dueDate', 'status', 'responsible', 'actions'];
  readonly statuses: { value: TaxObligationStatus; label: string }[] = [
    { value: 'PENDING', label: 'Pendiente' }, { value: 'IN_PROGRESS', label: 'En curso' }, { value: 'SUBMITTED', label: 'Presentada' }, { value: 'APPROVED', label: 'Aprobada' }, { value: 'OVERDUE', label: 'Vencida' }, { value: 'CANCELLED', label: 'Cancelada' },
  ];
  readonly types: { value: TaxObligationType; label: string }[] = [
    { value: 'VAT', label: 'IVA' }, { value: 'INCOME_TAX', label: 'Impuesto a las ganancias' }, { value: 'WITHHOLDING', label: 'Retenciones' }, { value: 'PAYROLL_TAX', label: 'Impuesto a la nómina' }, { value: 'OTHER', label: 'Otro' },
  ];
  readonly filters = this.fb.nonNullable.group({ company: '', country: '', status: '', type: '', responsibleUser: '', dueDate: '' });
  rows: TaxObligation[] = []; companies: Company[] = []; countries: Country[] = []; users: UserOption[] = []; loading = false; errorMessage = ''; total = 0; pageIndex = 0; pageSize = 20;
  constructor() { this.loadOptions(); this.load(); }
  get canWrite(): boolean { return this.auth.hasRole('ADMIN', 'TAX_MANAGER'); }
  loadOptions(): void {
    forkJoin({ companies: this.companiesApi.list(1, 100), countries: this.countriesApi.list(1, 100), users: this.usersApi.options() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => { this.companies = response.companies.data.filter((company) => company.isActive); this.countries = response.countries.data; this.users = response.users; },
      error: (error: unknown) => this.snack.open(apiErrorMessage(error, 'No se pudieron cargar las opciones de filtros.'), 'Cerrar', { duration: 5000 }),
    });
  }
  load(): void {
    this.loading = true; this.errorMessage = '';
    const form = this.filters.getRawValue();
    this.api.list({ company: form.company || undefined, country: form.country || undefined, status: (form.status || undefined) as TaxObligationStatus | undefined, type: (form.type || undefined) as TaxObligationType | undefined, responsibleUser: form.responsibleUser || undefined, dueDate: form.dueDate || undefined, page: this.pageIndex + 1, limit: this.pageSize }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (response) => { this.rows = response.data; this.total = response.meta.total; this.loading = false; }, error: (error: unknown) => { this.errorMessage = apiErrorMessage(error, 'No se pudieron cargar las obligaciones.'); this.loading = false; } });
  }
  applyFilters(): void { this.pageIndex = 0; this.load(); }
  clearFilters(): void { this.filters.reset(); this.pageIndex = 0; this.load(); }
  changePage(event: PageEvent): void { this.pageIndex = event.pageIndex; this.pageSize = event.pageSize; this.load(); }
  statusLabel(status: TaxObligationStatus): string { return this.statuses.find((entry) => entry.value === status)?.label ?? status; }
  typeLabel(type: TaxObligationType): string { return this.types.find((entry) => entry.value === type)?.label ?? type; }
  openEditor(record?: TaxObligation): void {
    forkJoin({ companies: this.companiesApi.list(1, 100), countries: this.countriesApi.list(1, 100), users: this.usersApi.options() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (options) => {
        const activeCompanies = options.companies.data.filter((company) => company.isActive);
        const activeUsers = options.users;
        if (!activeCompanies.length || !options.countries.data.length) { this.snack.open('Necesitás una empresa activa y al menos un país para registrar una obligación.', 'Cerrar', { duration: 4500 }); return; }
        const ref = this.dialog.open(EditorDialogComponent, { width: '720px', maxWidth: '95vw', data: { kind: 'obligation', record, countries: options.countries.data, companies: activeCompanies, users: activeUsers } });
        ref.afterClosed().pipe(filter((value): value is EditorResult => !!value), switchMap((value) => record ? this.api.update(record.id, value as Partial<TaxObligationInput>) : this.api.create(value as TaxObligationInput)), takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.snack.open(record ? 'Obligación actualizada correctamente.' : 'Obligación creada correctamente.', 'Cerrar', { duration: 3000 }); this.notificationsApi.refreshUnreadCount(); this.load(); }, error: (error: unknown) => this.snack.open(apiErrorMessage(error, 'No se pudo guardar la obligación.'), 'Cerrar', { duration: 5000 }) });
      }, error: (error: unknown) => this.snack.open(apiErrorMessage(error, 'No se pudieron cargar los datos para el formulario.'), 'Cerrar', { duration: 5000 }),
    });
  }
  confirmDelete(obligation: TaxObligation): void {
    this.dialog.open(ConfirmDialogComponent, { data: `¿Eliminar la obligación ${obligation.name}?`, width: '420px' }).afterClosed().pipe(filter((confirmed): confirmed is true => confirmed === true), switchMap(() => this.api.delete(obligation.id)), takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.snack.open('Obligación eliminada.', 'Cerrar', { duration: 3000 }); this.load(); }, error: (error: unknown) => this.snack.open(apiErrorMessage(error, 'No se pudo eliminar la obligación.'), 'Cerrar', { duration: 5000 }) });
  }
}

