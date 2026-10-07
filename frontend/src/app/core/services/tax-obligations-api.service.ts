import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PaginatedResponse } from '../../shared/models/api-response.model';
import { TaxObligation, TaxObligationFilters, TaxObligationInput } from '../../shared/models/tax-obligation.model';

@Injectable({ providedIn: 'root' })
export class TaxObligationsApiService {
  private readonly http = inject(HttpClient);
  list(filters: TaxObligationFilters = {}): Observable<PaginatedResponse<TaxObligation>> {
    let params = new HttpParams().set('page', filters.page ?? 1).set('limit', filters.limit ?? 20);
    for (const key of ['company', 'country', 'status', 'type', 'responsibleUser', 'dueDate'] as const) {
      const value = filters[key];
      if (value) params = params.set(key, value);
    }
    return this.http.get<PaginatedResponse<TaxObligation>>(`${API_BASE_URL}/tax-obligations`, { params });
  }
  get(id: string): Observable<TaxObligation> { return this.http.get<TaxObligation>(`${API_BASE_URL}/tax-obligations/${id}`); }
  create(input: TaxObligationInput): Observable<TaxObligation> { return this.http.post<TaxObligation>(`${API_BASE_URL}/tax-obligations`, input); }
  update(id: string, input: Partial<TaxObligationInput>): Observable<TaxObligation> { return this.http.patch<TaxObligation>(`${API_BASE_URL}/tax-obligations/${id}`, input); }
  delete(id: string): Observable<void> { return this.http.delete<void>(`${API_BASE_URL}/tax-obligations/${id}`); }
}