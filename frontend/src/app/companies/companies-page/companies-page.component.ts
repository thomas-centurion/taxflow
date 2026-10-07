import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, filter, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/feedback/feedback.service';
import { CompaniesApiService } from '../../core/services/companies-api.service';
import { CountriesApiService } from '../../core/services/countries-api.service';
import { Company } from '../../shared/models/company.model';
import { confirmAction } from '../../shared/ui/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { PagedList } from '../../shared/ui/paged-list';
import { EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent } from '../../shared/ui/states.component';
import { CompanyFormDialogComponent, CompanyFormDialogData } from '../company-form-dialog/company-form-dialog.component';

@Component({
  selector: 'app-companies-page',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, MatTableModule, MatTooltipModule, EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent, PageHeaderComponent],
  templateUrl: './companies-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompaniesPageComponent {
  private readonly api = inject(CompaniesApiService);
  private readonly countriesApi = inject(CountriesApiService);
  private readonly dialog = inject(MatDialog);
  private readonly feedback = inject(FeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canWrite = inject(AuthService).hasRole('ADMIN', 'TAX_MANAGER');
  readonly columns = ['name', 'taxId', 'country', 'status', 'actions'];
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly list = new PagedList<Company>((query) => this.api.list(query.page, query.limit, query.search), 'No se pudieron cargar las empresas.', this.destroyRef);

  constructor() {
    this.searchControl.valueChanges.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe((term) => this.list.setSearch(term));
  }

  clearSearch(): void { this.searchControl.setValue(''); }

  openEditor(record?: Company): void {
    this.countriesApi.list(1, 100).pipe(
      switchMap((countries) => {
        const data: CompanyFormDialogData = {
          record,
          countries: countries.data,
          save: (input) => (record ? this.api.update(record.id, input) : this.api.create(input)),
        };
        return this.dialog.open<CompanyFormDialogComponent, CompanyFormDialogData, Company>(CompanyFormDialogComponent, {
          data, width: '640px', maxWidth: '96vw', autoFocus: 'first-tabbable', restoreFocus: true,
        }).afterClosed();
      }),
      filter((saved): saved is Company => !!saved),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (saved) => { this.feedback.success(record ? `Se guardaron los cambios de "${saved.name}".` : `Se creó la empresa "${saved.name}".`); this.list.reload(); },
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudieron cargar los países.'),
    });
  }

  confirmDelete(company: Company): void {
    confirmAction(this.dialog, {
      title: 'Eliminar empresa',
      message: 'Solo se pueden eliminar empresas sin obligaciones ni documentos. Si ya no la gestionás, considerá desactivarla para conservar su historial.',
      subject: `${company.name} · ${company.taxId}`,
      confirmLabel: 'Eliminar empresa',
      destructive: true,
    }).pipe(
      switchMap(() => this.api.delete(company.id)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => { this.feedback.success(`Se eliminó "${company.name}".`); this.list.reload(); },
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudo eliminar la empresa.'),
    });
  }
}
