import { Company } from './company.model';
import { Country } from './country.model';
import { User } from './user.model';

export type TaxObligationType = 'VAT' | 'INCOME_TAX' | 'WITHHOLDING' | 'PAYROLL_TAX' | 'OTHER';
export type TaxObligationStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'OVERDUE' | 'CANCELLED';

export interface TaxObligation {
  id: string;
  companyId: string;
  company: Company;
  countryId: string;
  country: Country;
  name: string;
  description: string | null;
  type: TaxObligationType;
  status: TaxObligationStatus;
  isOverdue: boolean;
  dueDate: string;
  responsibleUserId: string | null;
  responsibleUser: User | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaxObligationInput {
  companyId: string;
  countryId: string;
  name: string;
  description?: string | null;
  type: TaxObligationType;
  status?: TaxObligationStatus;
  dueDate: string;
  responsibleUserId?: string | null;
}

export interface TaxObligationFilters {
  company?: string;
  country?: string;
  status?: TaxObligationStatus;
  type?: TaxObligationType;
  responsibleUser?: string;
  dueDate?: string;
  page?: number;
  limit?: number;
}