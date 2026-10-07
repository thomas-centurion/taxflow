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
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/feedback/feedback.service';
import { UsersApiService } from '../../core/services/users-api.service';
import { User } from '../../shared/models/user.model';
import { initials, personName } from '../../shared/presentation/format';
import { BadgeTone, roleLabel } from '../../shared/presentation/labels';
import { confirmAction } from '../../shared/ui/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { PagedList } from '../../shared/ui/paged-list';
import { EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent } from '../../shared/ui/states.component';
import { UserFormDialogComponent, UserFormDialogData } from '../user-form-dialog/user-form-dialog.component';

const ROLE_TONES: Record<User['role'], BadgeTone> = { ADMIN: 'violet', TAX_MANAGER: 'info', ANALYST: 'neutral' };

@Component({
  selector: 'app-users-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, MatTableModule, MatTooltipModule, EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent, PageHeaderComponent],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPageComponent {
  private readonly api = inject(UsersApiService);
  private readonly dialog = inject(MatDialog);
  private readonly feedback = inject(FeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUserId = inject(AuthService).currentUser?.id ?? '';
  readonly columns = ['name', 'role', 'status', 'actions'];
  readonly roleLabel = roleLabel;
  readonly initials = initials;
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly list = new PagedList<User>((query) => this.api.list(query.page, query.limit, query.search), 'No se pudieron cargar los usuarios.', this.destroyRef);

  constructor() {
    this.searchControl.valueChanges.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe((term) => this.list.setSearch(term));
  }

  clearSearch(): void { this.searchControl.setValue(''); }
  roleTone(user: User): BadgeTone { return ROLE_TONES[user.role]; }

  openEditor(record?: User): void {
    const data: UserFormDialogData = {
      record,
      isSelf: record?.id === this.currentUserId,
      save: (input) => (record ? this.api.update(record.id, input) : this.api.create(input)),
    };
    this.dialog.open<UserFormDialogComponent, UserFormDialogData, User>(UserFormDialogComponent, {
      data, width: '600px', maxWidth: '96vw', autoFocus: 'first-tabbable', restoreFocus: true,
    }).afterClosed().pipe(
      filter((saved): saved is User => !!saved),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((saved) => {
      this.feedback.success(record ? `Se guardaron los cambios de ${personName(saved)}.` : `Se creó el usuario ${personName(saved)}.`);
      this.list.reload();
    });
  }

  confirmDelete(user: User): void {
    confirmAction(this.dialog, {
      title: 'Eliminar usuario',
      message: 'La persona perderá el acceso a TaxFlow. Si cargó documentos no se puede eliminar: en ese caso, desactivala.',
      subject: `${personName(user)} · ${user.email}`,
      confirmLabel: 'Eliminar usuario',
      destructive: true,
    }).pipe(
      switchMap(() => this.api.delete(user.id)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => { this.feedback.success(`Se eliminó a ${personName(user)}.`); this.list.reload(); },
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudo eliminar el usuario.'),
    });
  }
}
