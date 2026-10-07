import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PaginatedResponse } from '../../shared/models/api-response.model';
import { Country, CountryInput } from '../../shared/models/country.model';

@Injectable({ providedIn: 'root' })
export class CountriesApiService {
  private readonly http = inject(HttpClient);
  list(page = 1, limit = 100, search = ''): Observable<PaginatedResponse<Country>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (search) params = params.set('search', search);
    return this.http.get<PaginatedResponse<Country>>(`${API_BASE_URL}/countries`, { params });
  }
  get(id: string): Observable<Country> { return this.http.get<Country>(`${API_BASE_URL}/countries/${id}`); }
  create(input: CountryInput): Observable<Country> { return this.http.post<Country>(`${API_BASE_URL}/countries`, input); }
  update(id: string, input: Partial<CountryInput>): Observable<Country> { return this.http.patch<Country>(`${API_BASE_URL}/countries/${id}`, input); }
  delete(id: string): Observable<void> { return this.http.delete<void>(`${API_BASE_URL}/countries/${id}`); }
}