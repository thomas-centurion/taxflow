import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { NotificationPage, TaxNotification } from '../../shared/models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);
  private readonly unreadCountSubject = new BehaviorSubject(0);
  readonly unreadCount$ = this.unreadCountSubject.asObservable();

  list(options: { page?: number; limit?: number; unread?: boolean } = {}): Observable<NotificationPage> {
    let params = new HttpParams();
    if (options.page !== undefined) params = params.set('page', options.page);
    if (options.limit !== undefined) params = params.set('limit', options.limit);
    if (options.unread !== undefined) params = params.set('unread', options.unread);
    return this.http.get<NotificationPage>(`${API_BASE_URL}/notifications`, { params });
  }

  unreadCount(): Observable<number> { return this.http.get<number>(`${API_BASE_URL}/notifications/unread-count`); }
  refreshUnreadCount(): void {
    this.unreadCount().subscribe({ next: (count) => this.unreadCountSubject.next(count), error: () => undefined });
  }
  markRead(id: string): Observable<TaxNotification> { return this.http.patch<TaxNotification>(`${API_BASE_URL}/notifications/${id}/read`, {}); }
  markAllRead(): Observable<{ updated: number }> { return this.http.patch<{ updated: number }>(`${API_BASE_URL}/notifications/read-all`, {}); }
}
