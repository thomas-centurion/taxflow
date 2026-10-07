import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PaginatedResponse } from '../../shared/models/api-response.model';
import { User, UserInput, UserOption } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  list(page = 1, limit = 20, search = ''): Observable<PaginatedResponse<User>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (search) params = params.set('search', search);
    return this.http.get<PaginatedResponse<User>>(`${API_BASE_URL}/users`, { params });
  }
  options(): Observable<UserOption[]> { return this.http.get<UserOption[]>(`${API_BASE_URL}/users/options`); }
  get(id: string): Observable<User> { return this.http.get<User>(`${API_BASE_URL}/users/${id}`); }
  create(input: UserInput): Observable<User> { return this.http.post<User>(`${API_BASE_URL}/users`, input); }
  update(id: string, input: Partial<UserInput>): Observable<User> { return this.http.patch<User>(`${API_BASE_URL}/users/${id}`, input); }
  delete(id: string): Observable<void> { return this.http.delete<void>(`${API_BASE_URL}/users/${id}`); }
}