import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Company } from '../models/company.model';
import { Country } from '../models/country.model';
import { TaxObligation, TaxObligationStatus, TaxObligationType } from '../models/tax-obligation.model';
import { User, UserInput, UserRole } from '../models/user.model';
import { CompanyInput } from '../models/company.model';
import { CountryInput } from '../models/country.model';
import { TaxObligationInput } from '../models/tax-obligation.model';

export type EditorKind = 'user' | 'company' | 'country' | 'obligation';
export interface EditorDialogData { kind: EditorKind; record?: User | Company | Country | TaxObligation; countries: Country[]; companies: Company[]; users: User[] }
export type EditorResult = UserInput | CompanyInput | CountryInput | TaxObligationInput;

@Component({
  selector: 'app-editor-dialog', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ title }}</h2>
    <mat-dialog-content><form [formGroup]="form" class="editor-form" (ngSubmit)="submit()">
      @switch (data.kind) {
        @case ('user') {
          <mat-form-field appearance="outline"><mat-label>Nombre</mat-label><input matInput formControlName="firstName" maxlength="80"><mat-error>Ingresá un nombre.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Apellido</mat-label><input matInput formControlName="lastName" maxlength="80"><mat-error>Ingresá un apellido.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput type="email" formControlName="email" maxlength="254"><mat-error>Ingresá un email válido.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ data.record ? 'Nueva contraseña (opcional)' : 'Contraseña' }}</mat-label><input matInput type="password" formControlName="password" autocomplete="new-password"><mat-hint>Al menos 8 caracteres.</mat-hint><mat-error>Usá entre 8 y 72 caracteres.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Rol</mat-label><mat-select formControlName="role"><mat-option value="ADMIN">Administrador</mat-option><mat-option value="TAX_MANAGER">Responsable fiscal</mat-option><mat-option value="ANALYST">Analista</mat-option></mat-select></mat-form-field>
          <mat-checkbox formControlName="isActive">Usuario activo</mat-checkbox>
        }
        @case ('company') {
          <mat-form-field appearance="outline"><mat-label>Nombre</mat-label><input matInput formControlName="name" maxlength="200"><mat-error>Ingresá un nombre.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Identificador fiscal</mat-label><input matInput formControlName="taxId" maxlength="100"><mat-error>Ingresá el identificador fiscal.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>País</mat-label><mat-select formControlName="countryId"><mat-option *ngFor="let country of data.countries" [value]="country.id">{{ country.name }} ({{ country.code }})</mat-option></mat-select><mat-error>Seleccioná un país.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Email (opcional)</mat-label><input matInput type="email" formControlName="email" maxlength="254"><mat-error>Ingresá un email válido.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Teléfono (opcional)</mat-label><input matInput formControlName="phone" maxlength="40"></mat-form-field>
          <mat-checkbox formControlName="isActive">Empresa activa</mat-checkbox>
        }
        @case ('country') {
          <mat-form-field appearance="outline"><mat-label>Nombre</mat-label><input matInput formControlName="name" maxlength="120"><mat-error>Ingresá un nombre.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Código ISO (2 letras)</mat-label><input matInput formControlName="code" maxlength="2"><mat-error>Ingresá un código de dos letras.</mat-error></mat-form-field>
        }
        @case ('obligation') {
          <mat-form-field appearance="outline"><mat-label>Nombre</mat-label><input matInput formControlName="name" maxlength="200"><mat-error>Ingresá el nombre.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Empresa</mat-label><mat-select formControlName="companyId"><mat-option *ngFor="let company of data.companies" [value]="company.id">{{ company.name }}</mat-option></mat-select><mat-error>Seleccioná una empresa.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>País</mat-label><mat-select formControlName="countryId"><mat-option *ngFor="let country of data.countries" [value]="country.id">{{ country.name }} ({{ country.code }})</mat-option></mat-select><mat-error>Seleccioná un país válido para la empresa.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Tipo</mat-label><mat-select formControlName="type"><mat-option value="VAT">IVA</mat-option><mat-option value="INCOME_TAX">Impuesto a las ganancias</mat-option><mat-option value="WITHHOLDING">Retenciones</mat-option><mat-option value="PAYROLL_TAX">Impuesto a la nómina</mat-option><mat-option value="OTHER">Otro</mat-option></mat-select><mat-error>Seleccioná un tipo.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Estado</mat-label><mat-select formControlName="status"><mat-option value="PENDING">Pendiente</mat-option><mat-option value="IN_PROGRESS">En curso</mat-option><mat-option value="SUBMITTED">Presentada</mat-option><mat-option value="APPROVED">Aprobada</mat-option><mat-option value="OVERDUE">Vencida</mat-option><mat-option value="CANCELLED">Cancelada</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Vencimiento</mat-label><input matInput type="date" formControlName="dueDate"><mat-error>Seleccioná una fecha válida.</mat-error></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Responsable</mat-label><mat-select formControlName="responsibleUserId"><mat-option [value]="null">Sin asignar</mat-option><mat-option *ngFor="let user of data.users" [value]="user.id">{{ user.firstName }} {{ user.lastName }} · {{ user.email }}</mat-option></mat-select></mat-form-field>
          <mat-form-field appearance="outline" class="description"><mat-label>Descripción (opcional)</mat-label><textarea matInput rows="3" formControlName="description"></textarea></mat-form-field>
        }
      }
    </form></mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cancelar</button><button mat-flat-button color="primary" (click)="submit()">{{ data.record ? 'Guardar cambios' : 'Crear' }}</button></mat-dialog-actions>
  `,
  styles: [`
    .editor-form{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;padding-top:8px;min-width:min(520px,72vw)}mat-form-field{width:100%}.description{grid-column:1/-1}mat-dialog-content{max-height:70vh}mat-dialog-actions{padding:12px 24px 18px}@media(max-width:560px){.editor-form{grid-template-columns:1fr;min-width:0}.description{grid-column:auto}}
  `],
})
export class EditorDialogComponent {
  readonly data = inject<EditorDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<EditorDialogComponent, EditorResult | undefined>);
  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(80)]], lastName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.email, Validators.maxLength(254)]], password: ['', [Validators.minLength(8), Validators.maxLength(72)]],
    role: ['ANALYST' as UserRole, Validators.required], isActive: [true],
    name: ['', [Validators.required, Validators.maxLength(200)]], taxId: ['', [Validators.required, Validators.maxLength(100)]],
    countryId: ['', Validators.required], phone: [''], code: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]{2}$/)]],
    companyId: ['', Validators.required], type: ['VAT' as TaxObligationType, Validators.required], status: ['PENDING' as TaxObligationStatus, Validators.required],
    dueDate: ['', Validators.required], responsibleUserId: this.fb.control<string | null>(null), description: [''],
  });

  constructor() {
    // The form is shared by every editor kind: disable controls not rendered for this kind so they don't block validation.
    const controlsByKind: Record<EditorKind, readonly string[]> = {
      user: ['firstName', 'lastName', 'email', 'password', 'role', 'isActive'],
      company: ['name', 'taxId', 'countryId', 'email', 'phone', 'isActive'],
      country: ['name', 'code'],
      obligation: ['name', 'companyId', 'countryId', 'type', 'status', 'dueDate', 'responsibleUserId', 'description'],
    };
    for (const [name, control] of Object.entries(this.form.controls)) {
      if (!controlsByKind[this.data.kind].includes(name)) control.disable();
    }
    if (this.data.kind === 'user') {
      this.form.controls.email.addValidators(Validators.required);
      if (!this.data.record) this.form.controls.password.addValidators(Validators.required);
    }
    const record = this.data.record;
    if (this.data.kind === 'user' && record) {
      const user = record as User;
      this.form.patchValue({ firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, isActive: user.isActive });
      this.form.controls.password.clearValidators();
      this.form.controls.password.addValidators([Validators.minLength(8), Validators.maxLength(72)]);
    } else if (this.data.kind === 'company' && record) {
      const company = record as Company;
      this.form.patchValue({ name: company.name, taxId: company.taxId, countryId: company.countryId, email: company.email ?? '', phone: company.phone ?? '', isActive: company.isActive });
    } else if (this.data.kind === 'country' && record) {
      const country = record as Country;
      this.form.patchValue({ name: country.name, code: country.code });
    } else if (this.data.kind === 'obligation' && record) {
      const obligation = record as TaxObligation;
      this.form.patchValue({ name: obligation.name, companyId: obligation.companyId, countryId: obligation.countryId, type: obligation.type, status: obligation.status, dueDate: obligation.dueDate, responsibleUserId: obligation.responsibleUserId, description: obligation.description ?? '' });
    }
    this.form.updateValueAndValidity();
  }

  get title(): string {
    const noun = this.data.kind === 'user' ? 'usuario' : this.data.kind === 'company' ? 'empresa' : this.data.kind === 'country' ? 'país' : 'obligación fiscal';
    return `${this.data.record ? 'Editar' : 'Crear'} ${noun}`;
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const result = (this.data.kind === 'user'
      ? { firstName: value.firstName.trim(), lastName: value.lastName.trim(), email: value.email.trim(), role: value.role, isActive: value.isActive, ...(value.password ? { password: value.password } : {}) }
      : this.data.kind === 'company'
        ? { name: value.name.trim(), taxId: value.taxId.trim(), countryId: value.countryId, email: value.email.trim() || null, phone: value.phone.trim() || null, isActive: value.isActive }
        : this.data.kind === 'country'
          ? { name: value.name.trim(), code: value.code.trim().toUpperCase() }
          : { name: value.name.trim(), companyId: value.companyId, countryId: value.countryId, type: value.type, status: value.status, dueDate: value.dueDate, responsibleUserId: value.responsibleUserId, description: value.description.trim() || null }) as EditorResult;
    this.dialogRef.close(result);
  }
}