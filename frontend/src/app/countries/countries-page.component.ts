import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { filter, switchMap } from 'rxjs';
import { CountriesApiService } from '../core/services/countries-api.service';
import { apiErrorMessage } from '../core/errors/api-error-message';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog.component';
import { EditorDialogComponent, EditorResult } from '../shared/components/editor-dialog.component';
import { Country, CountryInput } from '../shared/models/country.model';


const COUNTRY_STYLES = `:host{display:block}.page-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 22px}.eyebrow{margin:0 0 6px;color:#7b899a;font-size:10px;font-weight:700;letter-spacing:.13em}.page-head h1{margin:0;color:#1e3045;font-size:27px;letter-spacing:-.025em}.subtitle{margin:7px 0 0;color:#6b7a8d;font-size:13px}.page-head button{height:42px}.page-head button mat-icon{margin-right:5px}.panel{background:#fff;border:1px solid #e2e7ed;border-radius:10px;overflow:hidden}.toolbar{display:flex;align-items:center;gap:16px;padding:18px 20px 4px}.search{width:min(100%,340px)}.record-count{margin-left:auto;color:#758398;font-size:12px}.table-scroll{overflow-x:auto}.data-table{width:100%;min-width:450px}.data-table th{font-size:11px;color:#718094;font-weight:600;background:#fbfcfd}.data-table td{font-size:13px;color:#3c4b5e}.data-table td strong{color:#24364b;font-weight:600}.actions-head{text-align:right;padding-right:26px}.actions{text-align:right;white-space:nowrap}.actions button{width:36px;height:36px}.actions mat-icon{font-size:19px}.role-pill{display:inline-flex;padding:4px 9px;border-radius:20px;background:#f0f4f8;color:#596a7d;font-size:11px}.loading-state,.empty-state{min-height:190px;display:flex;align-items:center;justify-content:center;gap:12px;color:#6c7a8c;font-size:13px}.empty-state{flex-direction:column;gap:7px}.error-state{padding:18px;display:flex;align-items:center;gap:9px;color:#ac4136;background:#fff4f2;font-size:13px}.error-state button{margin-left:auto}.mat-mdc-paginator{border-top:1px solid #edf0f3}@media(max-width:600px){.page-head{align-items:flex-start;flex-direction:column}.toolbar{padding:14px 12px 0}}`;

@Component({
  selector: 'app-countries-page', standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatProgressSpinnerModule, MatTableModule],
  template: `
    <header class="page-head"><div><p class="eyebrow">CONFIGURACIÓN</p><h1>Países</h1><p class="subtitle">Países disponibles para la administración fiscal.</p></div><button mat-flat-button color="primary" (click)="openEditor()"><mat-icon>add</mat-icon> Nuevo país</button></header>
    <section class="panel"><div class="toolbar"><mat-form-field appearance="outline" class="search"><mat-label>Buscar país</mat-label><input matInput [(ngModel)]="searchText" (keyup.enter)="search()"><button mat-icon-button matSuffix aria-label="Buscar" (click)="search()"><mat-icon>search</mat-icon></button></mat-form-field><span class="record-count">{{ total }} países</span></div>
      @if (errorMessage) { <div class="error-state" role="alert"><mat-icon>error_outline</mat-icon>{{ errorMessage }} <button mat-button (click)="load()">Reintentar</button></div> }
      @if (loading) { <div class="loading-state"><mat-spinner diameter="32"></mat-spinner><span>Cargando países...</span></div> }
      @if (!loading && !errorMessage && rows.length === 0) { <div class="empty-state"><mat-icon>public</mat-icon><strong>No se encontraron países.</strong><span>Agregá un país para vincularlo a empresas.</span></div> }
      @if (!loading && rows.length > 0) { <div class="table-scroll"><table mat-table [dataSource]="rows" class="data-table">
        <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>País</th><td mat-cell *matCellDef="let row"><strong>{{ row.name }}</strong></td></ng-container>
        <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef>Código</th><td mat-cell *matCellDef="let row"><span class="role-pill">{{ row.code }}</span></td></ng-container>
        <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef class="actions-head">Acciones</th><td mat-cell *matCellDef="let row" class="actions"><button mat-icon-button aria-label="Editar país" (click)="openEditor(row)"><mat-icon>edit</mat-icon></button><button mat-icon-button color="warn" aria-label="Eliminar país" (click)="confirmDelete(row)"><mat-icon>delete_outline</mat-icon></button></td></ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr><tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table></div><mat-paginator [length]="total" [pageIndex]="pageIndex" [pageSize]="pageSize" [pageSizeOptions]="[10, 20, 50]" (page)="changePage($event)" aria-label="Paginación de países"></mat-paginator> }
    </section>
  `,
  styles: [COUNTRY_STYLES],
})
export class CountriesPageComponent {
  private readonly api = inject(CountriesApiService); private readonly dialog = inject(MatDialog); private readonly snack = inject(MatSnackBar); private readonly destroyRef = inject(DestroyRef);
  readonly columns = ['name', 'code', 'actions']; rows: Country[] = []; searchText = ''; searchTerm = ''; loading = false; errorMessage = ''; total = 0; pageIndex = 0; pageSize = 20;
  constructor() { this.load(); }
  load(): void { this.loading = true; this.errorMessage = ''; this.api.list(this.pageIndex + 1, this.pageSize, this.searchTerm).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (response) => { this.rows = response.data; this.total = response.meta.total; this.loading = false; }, error: (error: unknown) => { this.errorMessage = apiErrorMessage(error, 'No se pudieron cargar los países.'); this.loading = false; } }); }
  search(): void { this.searchTerm = this.searchText.trim(); this.pageIndex = 0; this.load(); }
  changePage(event: PageEvent): void { this.pageIndex = event.pageIndex; this.pageSize = event.pageSize; this.load(); }
  openEditor(record?: Country): void {
    const ref = this.dialog.open(EditorDialogComponent, { width: '560px', maxWidth: '95vw', data: { kind: 'country', record, countries: [], companies: [], users: [] } });
    ref.afterClosed().pipe(filter((value): value is EditorResult => !!value), switchMap((value) => record ? this.api.update(record.id, value as Partial<CountryInput>) : this.api.create(value as CountryInput)), takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.snack.open(record ? 'País actualizado correctamente.' : 'País creado correctamente.', 'Cerrar', { duration: 3000 }); this.load(); }, error: (error: unknown) => this.snack.open(apiErrorMessage(error, 'No se pudo guardar el país.'), 'Cerrar', { duration: 5000 }) });
  }
  confirmDelete(country: Country): void {
    this.dialog.open(ConfirmDialogComponent, { data: `¿Eliminar el país ${country.name}?`, width: '420px' }).afterClosed().pipe(filter((confirmed): confirmed is true => confirmed === true), switchMap(() => this.api.delete(country.id)), takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.snack.open('País eliminado.', 'Cerrar', { duration: 3000 }); this.load(); }, error: (error: unknown) => this.snack.open(apiErrorMessage(error, 'No se pudo eliminar el país.'), 'Cerrar', { duration: 5000 }) });
  }
}

