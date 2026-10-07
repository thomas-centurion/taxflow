import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
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
import { Company, CompanyInput } from '../../shared/models/company.model';
import { Country } from '../../shared/models/country.model';
import { saveFromDialog } from '../../shared/ui/dialog-save';

export interface CompanyFormDialogData {
  record?: Company;
  countries: Country[];
  save: (input: CompanyInput) => Observable<Company>;
}

@Component({
  selector: 'app-company-form-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule, MatSlideToggleModule],
  templateUrl: './company-form-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyFormDialogComponent {
  readonly data = inject<CompanyFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CompanyFormDialogComponent, Company>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly isEdit = !!this.data.record;
  readonly saving = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    name: [this.data.record?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    taxId: [this.data.record?.taxId ?? '', [Validators.required, Validators.maxLength(100)]],
    countryId: [this.data.record?.countryId ?? '', Validators.required],
    email: [this.data.record?.email ?? '', [Validators.email, Validators.maxLength(254)]],
    phone: [this.data.record?.phone ?? '', Validators.maxLength(40)],
    isActive: [this.data.record?.isActive ?? true],
  });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const input: CompanyInput = {
      name: value.name.trim(),
      taxId: value.taxId.trim(),
      countryId: value.countryId,
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
      isActive: value.isActive,
    };
    saveFromDialog(this.data.save(input), this.dialogRef, this, this.destroyRef, 'No se pudo guardar la empresa.');
  }
}
