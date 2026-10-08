import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AutomationRun } from '../../shared/models/automation-run.model';

@Injectable({ providedIn: 'root' })
export class AutomationRunsApiService {
  private readonly http = inject(HttpClient);

  /** Processes the obligation now; the API answers with the finished run (SUCCEEDED or FAILED). */
  run(obligationId: string): Observable<AutomationRun> {
    return this.http.post<AutomationRun>(`${API_BASE_URL}/tax-obligations/${obligationId}/automation-runs`, {});
  }

  listForObligation(obligationId: string): Observable<AutomationRun[]> {
    return this.http.get<AutomationRun[]>(`${API_BASE_URL}/tax-obligations/${obligationId}/automation-runs`);
  }
}
