import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/feedback/feedback.service';
import { NotificationsApiService } from '../../core/services/notifications-api.service';
import { TaxNotification } from '../../shared/models/notification.model';
import { NotificationsPageComponent } from './notifications-page.component';

const unread: TaxNotification = {
  id: 'notification-1', title: 'Vencimiento próximo', message: 'IVA mensual vence en 3 días', type: 'DEADLINE', isRead: false,
  createdAt: '2026-01-01T00:00:00.000Z', taxObligation: { id: 'obligation-1', name: 'IVA mensual' },
};

function setup(readOnly: boolean) {
  const api = {
    unreadCount$: new BehaviorSubject(1),
    refreshUnreadCount: vi.fn(),
    list: vi.fn(() => of({ data: [unread], meta: { page: 1, limit: 20, total: 1, pageCount: 1 } })),
    markRead: vi.fn(() => of({ ...unread, isRead: true })),
    markAllRead: vi.fn(() => of({ updated: 1 })),
  };
  const navigate = vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({
    imports: [NotificationsPageComponent],
    providers: [
      provideNoopAnimations(),
      { provide: NotificationsApiService, useValue: api },
      { provide: AuthService, useValue: { isReadOnly: readOnly } },
      { provide: FeedbackService, useValue: { success: vi.fn(), apiError: vi.fn() } },
      { provide: Router, useValue: { navigate } },
    ],
  });
  const fixture = TestBed.createComponent(NotificationsPageComponent);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  return { api, navigate, element, item: () => element.querySelector<HTMLButtonElement>('button.item')! };
}

describe('NotificationsPageComponent', () => {
  it('marks a notification as read when a regular user opens it', () => {
    const { api, navigate, element, item } = setup(false);
    expect(element.textContent).toContain('Marcar todas como leídas');
    item().click();
    expect(api.markRead).toHaveBeenCalledWith('notification-1');
    expect(navigate).toHaveBeenCalledWith(['/app/tax-obligations', 'obligation-1']);
  });

  it('lets a read-only demo account open notifications without writing anything', () => {
    const { api, navigate, element, item } = setup(true);
    expect(element.textContent).not.toContain('Marcar todas como leídas');
    item().click();
    expect(api.markRead).not.toHaveBeenCalled();
    expect(api.markAllRead).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/app/tax-obligations', 'obligation-1']);
  });
});
