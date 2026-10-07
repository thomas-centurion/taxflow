import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Observable } from 'rxjs';
import { User, UserInput, UserRole } from '../../shared/models/user.model';
import { ROLE_DESCRIPTIONS, ROLE_OPTIONS } from '../../shared/presentation/labels';
import { saveFromDialog } from '../../shared/ui/dialog-save';

export interface UserFormDialogData {
  record?: User;
  /** True when the record is the signed-in user (they cannot deactivate themselves from here by accident). */
  isSelf: boolean;
  save: (input: UserInput) => Observable<User>;
}

@Component({
  selector: 'app-user-form-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule, MatSlideToggleModule],
  templateUrl: './user-form-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormDialogComponent {
  readonly data = inject<UserFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<UserFormDialogComponent, User>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly isEdit = !!this.data.record;
  readonly roleOptions = ROLE_OPTIONS;
  readonly saving = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    firstName: [this.data.record?.firstName ?? '', [Validators.required, Validators.maxLength(80)]],
    lastName: [this.data.record?.lastName ?? '', [Validators.required, Validators.maxLength(80)]],
    email: [this.data.record?.email ?? '', [Validators.required, Validators.email, Validators.maxLength(254)]],
    // A password is required for new users; when editing, an empty value keeps the current one.
    password: ['', this.isEdit ? [Validators.minLength(8), Validators.maxLength(72)] : [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    role: [this.data.record?.role ?? ('ANALYST' as UserRole), Validators.required],
    isActive: [this.data.record?.isActive ?? true],
  });

  private readonly role = toSignal(this.form.controls.role.valueChanges, { initialValue: this.form.controls.role.value });
  readonly roleHint = computed(() => ROLE_DESCRIPTIONS[this.role()]);

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const input: UserInput = {
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      email: value.email.trim(),
      role: value.role,
      isActive: value.isActive,
      ...(value.password ? { password: value.password } : {}),
    };
    saveFromDialog(this.data.save(input), this.dialogRef, this, this.destroyRef, 'No se pudo guardar el usuario.');
  }
}
