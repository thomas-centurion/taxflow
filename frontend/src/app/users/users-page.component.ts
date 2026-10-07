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
import { EMPTY, catchError, filter, switchMap } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { UsersApiService } from '../core/services/users-api.service';
import { apiErrorMessage } from '../core/errors/api-error-message';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog.component';
import { EditorDialogComponent, EditorResult } from '../shared/components/editor-dialog.component';
import { User, UserInput } from '../shared/models/user.model';


const PAGE_STYLES = `:host{display:block}.page-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 22px}.eyebrow{margin:0 0 6px;color:#7b899a;font-size:10px;font-weight:700;letter-spacing:.13em}.page-head h1{margin:0;color:#1e3045;font-size:27px;letter-spacing:-.025em}.subtitle{margin:7px 0 0;color:#6b7a8d;font-size:13px}.page-head button{height:42px}.page-head button mat-icon{margin-right:5px}.panel{background:#fff;border:1px solid #e2e7ed;border-radius:10px;overflow:hidden}.toolbar{display:flex;align-items:center;gap:16px;padding:18px 20px 4px}.search{width:min(100%,340px)}.record-count{margin-left:auto;color:#758398;font-size:12px}.table-scroll{overflow-x:auto}.data-table{width:100%;min-width:650px}.data-table th{font-size:11px;color:#718094;font-weight:600;background:#fbfcfd}.data-table td{font-size:13px;color:#3c4b5e}.data-table td strong{color:#24364b;font-weight:600}.actions-head{text-align:right;padding-right:26px}.actions{text-align:right;white-space:nowrap}.actions button{width:36px;height:36px}.actions mat-icon{font-size:19px}.role-pill{display:inline-flex;padding:4px 9px;border-radius:20px;background:#f0f4f8;color:#596a7d;font-size:11px}.status{display:inline-flex;padding:4px 9px;border-radius:20px;background:#eaf5ee;color:#26734b;font-size:11px}.status.inactive{background:#f1f2f4;color:#747e89}.loading-state,.empty-state{min-height:190px;display:flex;align-items:center;justify-content:center;gap:12px;color:#6c7a8c;font-size:13px}.empty-state{flex-direction:column;gap:7px}.empty-state mat-icon{color:#93a1b1}.empty-state strong{color:#36485d}.error-state{padding:18px;display:flex;align-items:center;gap:9px;color:#ac4136;background:#fff4f2;font-size:13px}.error-state button{margin-left:auto}.mat-mdc-paginator{border-top:1px solid #edf0f3}@media(max-width:600px){.page-head{align-items:flex-start;flex-direction:column}.toolbar{padding:14px 12px 0}.record-count{font-size:11px}}`;

@Component({
  selector: 'app-users-page', standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatProgressSpinnerModule, MatTableModule],
  template: `
    <header class="page-head"><div><p class="eyebrow">ADMINISTRACIÓN</p><h1>Usuarios</h1><p class="subtitle">Personas con acceso a TaxFlow y sus permisos.</p></div><button mat-flat-button color="primary" (click)="openEditor()"><mat-icon>add</mat-icon> Nuevo usuario</button></header>
    <section class="panel">
      <div class="toolbar"><mat-form-field appearance="outline" class="search"><mat-label>Buscar usuario</mat-label><input matInput [(ngModel)]="searchText" (keyup.enter)="search()"><button mat-icon-button matSuffix aria-label="Buscar" (click)="search()"><mat-icon>search</mat-icon></button></mat-form-field><span class="record-count">{{ total }} usuarios</span></div>
      @if (errorMessage) { <div class="error-state" role="alert"><mat-icon>error_outline</mat-icon>{{ errorMessage }} <button mat-button (click)="load()">Reintentar</button></div> }
      @if (loading) { <div class="loading-state"><mat-spinner diameter="32"></mat-spinner><span>Cargando usuarios...</span></div> }
      @if (!loading && !errorMessage && rows.length === 0) { <div class="empty-state"><mat-icon>group</mat-icon><strong>No se encontraron usuarios.</strong><span>Probá cambiar la búsqueda.</span></div> }
      @if (!loading && rows.length > 0) {
        <div class="table-scroll"><table mat-table [dataSource]="rows" class="data-table">
          <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Nombre</th><td mat-cell *matCellDef="let row"><strong>{{ row.firstName }} {{ row.lastName }}</strong></td></ng-container>
          <ng-container matColumnDef="email"><th mat-header-cell *matHeaderCellDef>Email</th><td mat-cell *matCellDef="let row">{{ row.email }}</td></ng-container>
          <ng-container matColumnDef="role"><th mat-header-cell *matHeaderCellDef>Rol</th><td mat-cell *matCellDef="let row"><span class="role-pill">{{ roleLabel(row.role) }}</span></td></ng-container>
          <ng-container matColumnDef="active"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let row"><span class="status" [class.inactive]="!row.isActive">{{ row.isActive ? 'Activo' : 'Inactivo' }}</span></td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef class="actions-head">Acciones</th><td mat-cell *matCellDef="let row" class="actions"><button mat-icon-button aria-label="Editar usuario" (click)="openEditor(row)"><mat-icon>edit</mat-icon></button><button mat-icon-button color="warn" aria-label="Eliminar usuario" (click)="confirmDelete(row)"><mat-icon>delete_outline</mat-icon></button></td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr><tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table></div>
        <mat-paginator [length]="total" [pageIndex]="pageIndex" [pageSize]="pageSize" [pageSizeOptions]="[10, 20, 50]" (page)="changePage($event)" aria-label="Paginación de usuarios"></mat-paginator>
      }
    </section>
  `,
  styles: [PAGE_STYLES],
})
export class UsersPageComponent {
  private readonly api = inject(UsersApiService); private readonly auth = inject(AuthService); private readonly dialog = inject(MatDialog); private readonly snack = inject(MatSnackBar); private readonly destroyRef = inject(DestroyRef);
  readonly columns = ['name', 'email', 'role', 'active', 'actions']; rows: User[] = []; searchText = ''; searchTerm = ''; loading = false; errorMessage = ''; total = 0; pageIndex = 0; pageSize = 20;
  constructor() { this.load(); }
  load(): void { this.loading = true; this.errorMessage = ''; this.api.list(this.pageIndex + 1, this.pageSize, this.searchTerm).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (response) => { this.rows = response.data; this.total = response.meta.total; this.loading = false; }, error: (error: unknown) => { this.errorMessage = apiErrorMessage(error, 'No se pudieron cargar los usuarios.'); this.loading = false; } }); }
  search(): void { this.searchTerm = this.searchText.trim(); this.pageIndex = 0; this.load(); }
  changePage(event: PageEvent): void { this.pageIndex = event.pageIndex; this.pageSize = event.pageSize; this.load(); }
  roleLabel(role: User['role']): string { return role === 'ADMIN' ? 'Administrador' : role === 'TAX_MANAGER' ? 'Responsable fiscal' : 'Analista'; }
  openEditor(record?: User): void {
    const ref = this.dialog.open(EditorDialogComponent, { width: '620px', maxWidth: '95vw', data: { kind: 'user', record, countries: [], companies: [], users: [] } });
    ref.afterClosed().pipe(filter((value): value is EditorResult => !!value), switchMap((value) => record ? this.api.update(record.id, value as Partial<UserInput>) : this.api.create(value as UserInput)), takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.snack.open(record ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.', 'Cerrar', { duration: 3000 }); this.load(); }, error: (error: unknown) => this.snack.open(apiErrorMessage(error, 'No se pudo guardar el usuario.'), 'Cerrar', { duration: 5000 }) });
  }
  confirmDelete(user: User): void {
    this.dialog.open(ConfirmDialogComponent, { data: `¿Eliminar a ${user.firstName} ${user.lastName}?`, width: '420px' }).afterClosed().pipe(filter((confirmed): confirmed is true => confirmed === true), switchMap(() => this.api.delete(user.id)), takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.snack.open('Usuario eliminado.', 'Cerrar', { duration: 3000 }); this.load(); }, error: (error: unknown) => this.snack.open(apiErrorMessage(error, 'No se pudo eliminar el usuario.'), 'Cerrar', { duration: 5000 }) });
  }
}

