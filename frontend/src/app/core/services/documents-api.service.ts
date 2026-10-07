import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { TaxDocument } from '../../shared/models/document.model';

@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  private readonly http = inject(HttpClient);

  listForObligation(obligationId: string): Observable<TaxDocument[]> {
    return this.http.get<TaxDocument[]>(`${API_BASE_URL}/tax-obligations/${obligationId}/documents`);
  }

  upload(obligationId: string, file: File): Observable<HttpEvent<TaxDocument>> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<TaxDocument>(`${API_BASE_URL}/tax-obligations/${obligationId}/documents`, body, { observe: 'events', reportProgress: true });
  }

  download(id: string): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}/documents/${id}/download`, { responseType: 'blob' });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/documents/${id}`);
  }
}
