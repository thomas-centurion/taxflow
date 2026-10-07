import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PaginatedResponse } from '../../shared/models/api-response.model';
import { Company, CompanyInput } from '../../shared/models/company.model';

@Injectable({ providedIn: 'root' })
export class CompaniesApiService {
  private readonly http = inject(HttpClient);
  list(page = 1, limit = 20, search = ''): Observable<PaginatedResponse<Company>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (search) params = params.set('search', search);
    return this.http.get<PaginatedResponse<Company>>(`${API_BASE_URL}/companies`, { params });
  }
  get(id: string): Observable<Company> { return this.http.get<Company>(`${API_BASE_URL}/companies/${id}`); }
  create(input: CompanyInput): Observable<Company> { return this.http.post<Company>(`${API_BASE_URL}/companies`, input); }
  update(id: string, input: Partial<CompanyInput>): Observable<Company> { return this.http.patch<Company>(`${API_BASE_URL}/companies/${id}`, input); }
  delete(id: string): Observable<void> { return this.http.delete<void>(`${API_BASE_URL}/companies/${id}`); }
}