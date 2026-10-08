import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AutomationRunsApiService } from './automation-runs-api.service';
import { NotificationsApiService } from './notifications-api.service';
import { TaxObligationsApiService } from './tax-obligations-api.service';

describe('API services', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('TaxObligationsApiService sends only the filters that are set', () => {
    TestBed.inject(TaxObligationsApiService).list({ status: 'OVERDUE', company: 'company-1', type: undefined, dueDate: '', page: 2, limit: 50 }).subscribe();
    const request = http.expectOne((candidate) => candidate.url === `${API_BASE_URL}/tax-obligations`);
    expect(request.request.params.toString()).toBe('page=2&limit=50&company=company-1&status=OVERDUE');
  });

  it('TaxObligationsApiService uses the default page size', () => {
    TestBed.inject(TaxObligationsApiService).list().subscribe();
    expect(http.expectOne((candidate) => candidate.url === `${API_BASE_URL}/tax-obligations`).request.params.toString()).toBe('page=1&limit=20');
  });

  it('NotificationsApiService keeps the last unread count when a refresh fails', async () => {
    const notifications = TestBed.inject(NotificationsApiService);
    notifications.refreshUnreadCount();
    http.expectOne(`${API_BASE_URL}/notifications/unread-count`).flush(4);
    notifications.refreshUnreadCount();
    http.expectOne(`${API_BASE_URL}/notifications/unread-count`).flush(null, { status: 503, statusText: 'Unavailable' });
    expect(await firstValueFrom(notifications.unreadCount$)).toBe(4);
  });

  it('NotificationsApiService filters by read state only when requested', () => {
    const notifications = TestBed.inject(NotificationsApiService);
    notifications.list({ unread: false, limit: 5 }).subscribe();
    expect(http.expectOne((candidate) => candidate.url === `${API_BASE_URL}/notifications`).request.params.toString()).toBe('limit=5&unread=false');
  });

  it('AutomationRunsApiService targets the obligation automation endpoints', () => {
    const runs = TestBed.inject(AutomationRunsApiService);
    runs.run('obligation-1').subscribe();
    runs.listForObligation('obligation-1').subscribe();
    const requests = http.match(`${API_BASE_URL}/tax-obligations/obligation-1/automation-runs`);
    expect(requests.map((request) => request.request.method)).toEqual(['POST', 'GET']);
    requests.forEach((request) => request.flush([]));
  });
});
