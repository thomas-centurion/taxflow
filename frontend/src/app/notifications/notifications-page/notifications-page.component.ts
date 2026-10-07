import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../core/errors/api-error-message';
import { FeedbackService } from '../../core/feedback/feedback.service';
import { NotificationsApiService } from '../../core/services/notifications-api.service';
import { TaxNotification } from '../../shared/models/notification.model';
import { NOTIFICATION_ICONS } from '../../shared/presentation/labels';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent } from '../../shared/ui/states.component';
import { TimeAgoPipe } from '../../shared/ui/time-ago.pipe';

type View = 'all' | 'unread';
const PAGE_SIZE = 20;

@Component({
  selector: 'app-notifications-page',
  imports: [DatePipe, MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressBarModule, EmptyStateComponent, ErrorStateComponent, LoadingRowsComponent, PageHeaderComponent, TimeAgoPipe],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPageComponent {
  private readonly api = inject(NotificationsApiService);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  readonly icons = NOTIFICATION_ICONS;
  readonly unreadCount = toSignal(this.api.unreadCount$, { initialValue: 0 });
  readonly view = signal<View>('all');
  readonly items = signal<TaxNotification[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  private page = 1;

  constructor() {
    this.api.refreshUnreadCount();
    this.load();
  }

  setView(view: View): void {
    this.view.set(view);
    this.load();
  }

  load(append = false): void {
    this.page = append ? this.page + 1 : 1;
    this.loading.set(true);
    this.error.set('');
    this.api.list({ page: this.page, limit: PAGE_SIZE, ...(this.view() === 'unread' ? { unread: true } : {}) }).pipe(
      finalize(() => this.loading.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (page) => {
        this.items.update((current) => (append ? [...current, ...page.data] : page.data));
        this.total.set(page.meta.total);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error, 'No se pudieron cargar las notificaciones.')),
    });
  }

  markAllRead(): void {
    this.api.markAllRead().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ updated }) => {
        this.api.refreshUnreadCount();
        this.feedback.success(updated === 1 ? 'Se marcó 1 notificación como leída.' : `Se marcaron ${updated} notificaciones como leídas.`);
        this.load();
      },
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudieron actualizar las notificaciones.'),
    });
  }

  open(item: TaxNotification): void {
    const navigate = (): void => { if (item.taxObligation) void this.router.navigate(['/app/tax-obligations', item.taxObligation.id]); };
    if (item.isRead) { navigate(); return; }
    this.api.markRead(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items.update((items) => items.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
        this.api.refreshUnreadCount();
        navigate();
      },
      error: (error: unknown) => this.feedback.apiError(error, 'No se pudo marcar la notificación como leída.'),
    });
  }
}
