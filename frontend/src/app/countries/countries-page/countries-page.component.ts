import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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
import { FeedbackService } from '../../core/feedback/feedback.service';
import { CountriesApiService } from '../../core/services/countries-api.service';
import { Country } from '../../shared/models/country.model';
import { confirmAction } from '../../shared/ui/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { PagedList } from '../../shared/ui/paged-list';
import { EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent } from '../../shared/ui/states.component';
import { CountryFormDialogComponent, CountryFormDialogData } from '../country-form-dialog/country-form-dialog.component';

@Component({
  selector: 'app-countries-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, MatTableModule, MatTooltipModule, EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent, PageHeaderComponent],
  templateUrl: './countries-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountriesPageComponent {
  private readonly api = inject(CountriesApiService);
  private readonly dialog = inject(MatDialog);
  private readonly feedback = inject(FeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  readonly columns = ['name', 'code', 'actions'];
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly list = new PagedList<Country>((query) => this.api.list(query.page, query.limit, query.search), 'No se pudieron cargar los países.', this.destroyRef);

  constructor() {
    this.searchControl.valueChanges.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe((term) => this.list.setSearch(term));
  }

  clearSearch(): void { this.searchControl.setValue(''); }

  openEditor(record?: Country): void {
    const data: CountryFormDialogData = { record, save: (input) => (record ? this.api.update(record.id, input) : this.api.create(input)) };
    this.dialog.open<CountryFormDialogComponent, CountryFormDialogData, Country>(CountryFormDialogComponent, {
      data, width: '520px', maxWidth: '96vw', autoFocus: 'first-tabbable', restoreFocus: true,
    }).afterClosed().pipe(
      filter((saved): saved is Country => !!saved),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((saved) => {
      this.feedback.success(record ? `Se guardaron los cambios de ${saved.name}.` : `Se agregó ${saved.name}.`);
      this.list.reload();
    });
  }

  confirmDelete(country: Country): void {
    confirmAction(this.dialog, {
      title: 'Eliminar país',
      message: 'Solo se pueden eliminar países sin empresas ni obligaciones asociadas.',
      subject: `${country.name} (${country.code})`,
      confirmLabel: 'Eliminar país',
      destructive: true,
    }).pipe(
      switchMap(() => this.api.delete(country.id)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => { this.feedback.success(`Se eliminó ${country.name}.`); this.list.reload(); },
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudo eliminar el país.'),
    });
  }
}
