import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { aCompany, anObligation, argentina } from '../../../testing/fixtures';
import { Country } from '../../shared/models/country.model';
import { ObligationFormDialogComponent, ObligationFormDialogData } from './obligation-form-dialog.component';

const chile: Country = { id: 'country-cl', name: 'Chile', code: 'CL', createdAt: '2026-01-01T00:00:00.000Z' };
const acme = aCompany();
const andes = aCompany({ id: 'company-andes', name: 'Andes', countryId: chile.id, country: chile });

function setup(data: Partial<ObligationFormDialogData> = {}) {
  const save = vi.fn<ObligationFormDialogData['save']>((input) => of(anObligation({ name: input.name })));
  const dialogRef = { close: vi.fn(), disableClose: false };
  TestBed.configureTestingModule({
    imports: [ObligationFormDialogComponent],
    providers: [
      provideNoopAnimations(),
      { provide: MAT_DIALOG_DATA, useValue: { companies: [acme, andes], users: [], save, ...data } },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
  const fixture = TestBed.createComponent(ObligationFormDialogComponent);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, save, dialogRef };
}

describe('ObligationFormDialogComponent', () => {
  it('does not save an incomplete form and marks the missing fields', () => {
    const { component, save } = setup();
    component.submit();
    expect(save).not.toHaveBeenCalled();
    expect(component.form.controls.name.touched).toBe(true);
    expect(component.form.controls.companyId.hasError('required')).toBe(true);
  });

  it('takes the country from the selected company', () => {
    const { component } = setup();
    expect(component.country()).toBeNull();
    component.form.controls.companyId.setValue(andes.id);
    expect(component.country()).toEqual(chile);
  });

  it('sends a clean payload and closes with the saved obligation', () => {
    const { component, save, dialogRef } = setup();
    component.form.setValue({
      name: '  IVA octubre  ', companyId: acme.id, type: 'VAT', status: 'PENDING', dueDate: '2026-10-20', responsibleUserId: null, description: '   ',
    });
    component.submit();
    expect(save).toHaveBeenCalledWith({
      name: 'IVA octubre', companyId: acme.id, countryId: argentina.id, type: 'VAT', status: 'PENDING', dueDate: '2026-10-20', responsibleUserId: null, description: null,
    });
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ name: 'IVA octubre' }));
    expect(component.saving()).toBe(false);
  });

  it('keeps the dialog open and explains a rejected change', () => {
    const rejected = new HttpErrorResponse({ status: 409, error: { message: 'Invalid status transition from APPROVED to PENDING.' } });
    const { component, dialogRef } = setup({ record: anObligation({ status: 'APPROVED' }), save: () => throwError(() => rejected) });
    component.form.controls.status.setValue('PENDING');
    component.submit();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.error()).toMatch(/No se puede pasar de "Aprobada" a "Pendiente"/);
    expect(dialogRef.disableClose).toBe(false);
  });

  it('keeps an inactive company and responsible user that are already assigned when editing', () => {
    const closed = aCompany({ id: 'company-closed', name: 'Closed', isActive: false });
    const formerUser = { id: 'user-gone', firstName: 'Former', lastName: 'Owner', email: 'former@example.com', role: 'ANALYST' as const, isActive: false, createdAt: '', updatedAt: '' };
    const { component } = setup({ record: anObligation({ company: closed, responsibleUserId: formerUser.id, responsibleUser: formerUser }) });
    expect(component.companies.map((company) => company.id)).toEqual(['company-closed', acme.id, andes.id]);
    expect(component.users.map((user) => user.id)).toEqual(['user-gone']);
    expect(component.form.controls.companyId.value).toBe('company-closed');
  });
});
