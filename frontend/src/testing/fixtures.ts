import { AutomationRun } from '../app/shared/models/automation-run.model';
import { Company } from '../app/shared/models/company.model';
import { Country } from '../app/shared/models/country.model';
import { TaxObligation } from '../app/shared/models/tax-obligation.model';
import { User } from '../app/shared/models/user.model';

export const argentina: Country = { id: 'country-ar', name: 'Argentina', code: 'AR', createdAt: '2026-01-01T00:00:00.000Z' };

export function aUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-manager', firstName: 'Taylor', lastName: 'Manager', email: 'manager@taxflow.local', role: 'TAX_MANAGER',
    isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides,
  };
}

export function aCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-acme', name: 'ACME', taxId: '30-1', countryId: argentina.id, country: argentina, email: null, phone: null,
    isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides,
  };
}

export function anObligation(overrides: Partial<TaxObligation> = {}): TaxObligation {
  const company = overrides.company ?? aCompany();
  return {
    id: 'obligation-1', companyId: company.id, company, countryId: company.countryId, country: company.country,
    name: 'IVA mensual', description: null, type: 'VAT', status: 'PENDING', isOverdue: false, dueDate: '2026-10-20',
    responsibleUserId: null, responsibleUser: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function aRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: 'run-1', taxObligationId: 'obligation-1', trigger: 'MANUAL', status: 'SUCCEEDED',
    requestedBy: { id: 'user-manager', firstName: 'Taylor', lastName: 'Manager' },
    startedAt: '2026-10-08T12:00:00.000Z', finishedAt: '2026-10-08T12:00:00.020Z', errorCode: null, errorMessage: null,
    result: { previousStatus: 'PENDING', status: 'PENDING', overdueMarked: false, notificationsCreated: 0, withoutResponsible: false, durationMs: 20 },
    createdAt: '2026-10-08T12:00:00.000Z', ...overrides,
  };
}
