import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AuditLogFilters, AuditLogPage } from '../../shared/models/audit-log.model';

@Injectable({ providedIn: 'root' })
export class AuditLogsApiService {
  private readonly http = inject(HttpClient);

  list(filters: AuditLogFilters): Observable<AuditLogPage> {
    let params = new HttpParams().set('page', filters.page).set('limit', filters.limit);
    if (filters.action) params = params.set('action', filters.action);
    if (filters.entityType) params = params.set('entityType', filters.entityType);
    if (filters.actor) params = params.set('actor', filters.actor);
    if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
    return this.http.get<AuditLogPage>(`${API_BASE_URL}/audit-logs`, { params });
  }
}
