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
import { Observable } from 'rxjs';
import { Company } from '../../shared/models/company.model';
import { TaxObligation, TaxObligationInput, TaxObligationStatus, TaxObligationType } from '../../shared/models/tax-obligation.model';
import { UserOption } from '../../shared/models/user.model';
import { OBLIGATION_STATUS, OBLIGATION_STATUS_OPTIONS, OBLIGATION_TYPE_OPTIONS } from '../../shared/presentation/labels';
import { saveFromDialog } from '../../shared/ui/dialog-save';

export interface ObligationFormDialogData {
  record?: TaxObligation;
  companies: Company[];
  users: UserOption[];
  save: (input: TaxObligationInput) => Observable<TaxObligation>;
}

@Component({
  selector: 'app-obligation-form-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule],
  templateUrl: './obligation-form-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObligationFormDialogComponent {
  readonly data = inject<ObligationFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ObligationFormDialogComponent, TaxObligation>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly isEdit = !!this.data.record;
  readonly typeOptions = OBLIGATION_TYPE_OPTIONS;
  readonly statusOptions = OBLIGATION_STATUS_OPTIONS;
  readonly saving = signal(false);
  readonly error = signal('');

  /** Inactive companies/users are not offered, except the ones already assigned to the record being edited. */
  readonly companies: Company[] = withCurrent(this.data.companies, this.data.record?.company);
  readonly users: UserOption[] = withCurrent(this.data.users, this.data.record?.responsibleUser ?? undefined);

  readonly form = this.fb.nonNullable.group({
    name: [this.data.record?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    companyId: [this.data.record?.companyId ?? '', Validators.required],
    type: [this.data.record?.type ?? ('VAT' as TaxObligationType), Validators.required],
    status: [this.data.record?.status ?? ('PENDING' as TaxObligationStatus), Validators.required],
    dueDate: [this.data.record?.dueDate ?? '', Validators.required],
    responsibleUserId: this.fb.control<string | null>(this.data.record?.responsibleUserId ?? null),
    description: [this.data.record?.description ?? ''],
  });

  private readonly companyId = toSignal(this.form.controls.companyId.valueChanges, { initialValue: this.form.controls.companyId.value });
  private readonly status = toSignal(this.form.controls.status.valueChanges, { initialValue: this.form.controls.status.value });

  /** The obligation's country always follows its company (the API rejects mismatches). */
  readonly country = computed(() => this.companies.find((company) => company.id === this.companyId())?.country ?? null);
  readonly statusHint = computed(() => OBLIGATION_STATUS[this.status()].description);

  submit(): void {
    const country = this.country();
    if (this.form.invalid || !country) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const input: TaxObligationInput = {
      name: value.name.trim(),
      companyId: value.companyId,
      countryId: country.id,
      type: value.type,
      status: value.status,
      dueDate: value.dueDate,
      responsibleUserId: value.responsibleUserId,
      description: value.description.trim() || null,
    };
    saveFromDialog(this.data.save(input), this.dialogRef, this, this.destroyRef, 'No se pudo guardar la obligación.');
  }
}

function withCurrent<T extends { id: string }>(options: T[], current: T | undefined): T[] {
  return current && !options.some((option) => option.id === current.id) ? [current, ...options] : options;
}
