import { Country } from './country.model';

export interface Company {
  id: string;
  name: string;
  taxId: string;
  countryId: string;
  country: Country;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyInput {
  name: string;
  taxId: string;
  countryId: string;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean;
}