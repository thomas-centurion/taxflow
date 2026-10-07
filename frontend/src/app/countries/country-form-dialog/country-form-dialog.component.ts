import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';
import { Country, CountryInput } from '../../shared/models/country.model';
import { saveFromDialog } from '../../shared/ui/dialog-save';

export interface CountryFormDialogData {
  record?: Country;
  save: (input: CountryInput) => Observable<Country>;
}

@Component({
  selector: 'app-country-form-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  templateUrl: './country-form-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountryFormDialogComponent {
  readonly data = inject<CountryFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CountryFormDialogComponent, Country>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly isEdit = !!this.data.record;
  readonly saving = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    name: [this.data.record?.name ?? '', [Validators.required, Validators.maxLength(120)]],
    code: [this.data.record?.code ?? '', [Validators.required, Validators.pattern(/^[a-zA-Z]{2}$/)]],
  });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const input: CountryInput = { name: value.name.trim(), code: value.code.trim().toUpperCase() };
    saveFromDialog(this.data.save(input), this.dialogRef, this, this.destroyRef, 'No se pudo guardar el país.');
  }
}
