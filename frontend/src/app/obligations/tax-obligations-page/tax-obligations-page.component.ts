import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
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
import { BehaviorSubject, catchError, combineLatest, debounceTime, finalize, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/errors/api-error-message';
import { FeedbackService } from '../../core/feedback/feedback.service';
import { CompaniesApiService } from '../../core/services/companies-api.service';
import { CountriesApiService } from '../../core/services/countries-api.service';
import { TaxObligationsApiService } from '../../core/services/tax-obligations-api.service';
import { UsersApiService } from '../../core/services/users-api.service';
import { Company } from '../../shared/models/company.model';
import { Country } from '../../shared/models/country.model';
import { TaxObligation, TaxObligationFilters } from '../../shared/models/tax-obligation.model';
import { UserOption } from '../../shared/models/user.model';
import { personName } from '../../shared/presentation/format';
import { OBLIGATION_STATUS_OPTIONS, OBLIGATION_TYPE_OPTIONS, typeLabel } from '../../shared/presentation/labels';
import { confirmAction } from '../../shared/ui/confirm-dialog.component';
import { DueDateComponent } from '../../shared/ui/due-date.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent } from '../../shared/ui/states.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { ObligationEditorService } from '../obligation-editor.service';

const FILTER_KEYS = ['company', 'country', 'status', 'type', 'responsibleUser', 'dueDate'] as const;
type FilterKey = typeof FILTER_KEYS[number];
const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-tax-obligations-page',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, MatSelectModule, MatTableModule, MatTooltipModule, DueDateComponent, EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent, PageHeaderComponent, StatusBadgeComponent],
  templateUrl: './tax-obligations-page.component.html',
  styleUrl: './tax-obligations-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxObligationsPageComponent {
  private readonly api = inject(TaxObligationsApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly countriesApi = inject(CountriesApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly editor = inject(ObligationEditorService);
  private readonly feedback = inject(FeedbackService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly canWrite = inject(AuthService).canWrite('ADMIN', 'TAX_MANAGER');
  readonly columns = this.canWrite
    ? ['name', 'company', 'dueDate', 'status', 'responsible', 'actions']
    : ['name', 'company', 'dueDate', 'status', 'responsible'];
  readonly statusOptions = OBLIGATION_STATUS_OPTIONS;
  readonly typeOptions = OBLIGATION_TYPE_OPTIONS;
  readonly typeLabel = typeLabel;
  readonly personName = personName;

  readonly filters = inject(FormBuilder).nonNullable.group({ company: '', country: '', status: '', type: '', responsibleUser: '', dueDate: '' });

  readonly rows = signal<TaxObligation[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly activeFilters = signal(0);
  readonly companies = signal<Company[]>([]);
  readonly countries = signal<Country[]>([]);
  readonly users = signal<UserOption[]>([]);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  constructor() {
    this.loadFilterOptions();

    combineLatest([this.route.queryParamMap, this.reload$]).pipe(
      map(([params]) => this.readQuery(params)),
      tap((query) => {
        this.filters.patchValue(query.filters, { emitEvent: false });
        this.pageIndex.set(query.page - 1);
        this.pageSize.set(query.limit);
        this.activeFilters.set(Object.values(query.filters).filter(Boolean).length);
        this.loading.set(true);
        this.error.set('');
      }),
      switchMap((query) => this.api.list({ ...query.filters, page: query.page, limit: query.limit } as TaxObligationFilters).pipe(
        catchError((error: unknown) => { this.error.set(apiErrorMessage(error, 'No se pudieron cargar las obligaciones.')); return of(null); }),
        finalize(() => this.loading.set(false)),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((response) => {
      this.loading.set(false);
      if (!response) return;
      this.rows.set(response.data);
      this.total.set(response.meta.total);
    });

    this.filters.valueChanges.pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const queryParams: Record<string, string | null> = { page: null };
      for (const key of FILTER_KEYS) queryParams[key] = value[key] || null;
      void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }

  clearFilters(): void { this.filters.reset(); }

  reload(): void { this.reload$.next(); }

  changePage(event: PageEvent): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page: event.pageIndex + 1, size: event.pageSize }, queryParamsHandling: 'merge' });
  }

  openEditor(record?: TaxObligation): void {
    this.editor.open(record).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.reload(),
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudieron cargar los datos del formulario.'),
    });
  }

  confirmDelete(obligation: TaxObligation): void {
    confirmAction(this.dialog, {
      title: 'Eliminar obligación',
      message: 'Se eliminará esta obligación fiscal. El registro de auditoría se conserva. Si tiene documentos cargados, primero tenés que eliminarlos.',
      subject: `${obligation.name} · ${obligation.company.name}`,
      confirmLabel: 'Eliminar',
      destructive: true,
    }).pipe(
      switchMap(() => this.api.delete(obligation.id)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => { this.feedback.success(`Se eliminó "${obligation.name}".`); this.reload(); },
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudo eliminar la obligación.'),
    });
  }

  private loadFilterOptions(): void {
    forkJoin({ companies: this.companiesApi.list(1, 100), countries: this.countriesApi.list(1, 100), users: this.usersApi.options() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ companies, countries, users }) => { this.companies.set(companies.data); this.countries.set(countries.data); this.users.set(users); },
        error: (error: unknown) => this.feedback.apiError(error, 'No se pudieron cargar las opciones de los filtros.'),
      });
  }

  private readQuery(params: ParamMap): { filters: Record<FilterKey, string>; page: number; limit: number } {
    const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ''])) as Record<FilterKey, string>;
    if (filters.status && !this.statusOptions.some((option) => option.value === filters.status)) filters.status = '';
    if (filters.type && !this.typeOptions.some((option) => option.value === filters.type)) filters.type = '';
    const page = Math.max(1, Number(params.get('page')) || 1);
    const size = Number(params.get('size'));
    return { filters, page, limit: [10, 20, 50].includes(size) ? size : DEFAULT_PAGE_SIZE };
  }
}

