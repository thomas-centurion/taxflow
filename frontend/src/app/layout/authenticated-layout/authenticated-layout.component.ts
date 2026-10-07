import { BreakpointObserver } from '@angular/cdk/layout';
import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, finalize, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationsApiService } from '../../core/services/notifications-api.service';
import { TaxNotification } from '../../shared/models/notification.model';
import { initials } from '../../shared/presentation/format';
import { NOTIFICATION_ICONS, roleLabel } from '../../shared/presentation/labels';
import { TimeAgoPipe } from '../../shared/ui/time-ago.pipe';

interface NavLink { label: string; path: string; icon: string; exact?: boolean; badge?: 'unread' }
interface NavGroup { label: string; links: NavLink[] }

@Component({
  selector: 'app-authenticated-layout',
  imports: [AsyncPipe, RouterLink, RouterLinkActive, RouterOutlet, MatBadgeModule, MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatSidenavModule, MatTooltipModule, TimeAgoPipe],
  templateUrl: './authenticated-layout.component.html',
  styleUrl: './authenticated-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedLayoutComponent {
  readonly auth = inject(AuthService);
  private readonly notificationsApi = inject(NotificationsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly roleLabel = roleLabel;
  readonly initials = initials;
  readonly notificationIcons = NOTIFICATION_ICONS;

  /** Navigation is computed once per session from the user's role (stable data, see AGENTS.md §10). */
  readonly navGroups: NavGroup[] = [];

  readonly isMobile = toSignal(inject(BreakpointObserver).observe('(max-width: 960px)').pipe(map((state) => state.matches)), { initialValue: false });
  readonly unreadCount = toSignal(this.notificationsApi.unreadCount$, { initialValue: 0 });
  readonly sectionTitle = signal('');
  readonly recentNotifications = signal<TaxNotification[]>([]);
  readonly notificationsLoading = signal(false);
  readonly notificationError = signal('');

  constructor() {
    const role = this.auth.currentUser?.role;
    this.navGroups.push({
      label: 'Operación',
      links: [
        { label: 'Inicio', path: '/app', icon: 'space_dashboard', exact: true },
        { label: 'Obligaciones fiscales', path: '/app/tax-obligations', icon: 'assignment' },
        { label: 'Empresas', path: '/app/companies', icon: 'apartment' },
        { label: 'Notificaciones', path: '/app/notifications', icon: 'notifications', badge: 'unread' },
      ],
    });
    const adminLinks: NavLink[] = [];
    if (role === 'ADMIN') adminLinks.push({ label: 'Usuarios', path: '/app/users', icon: 'group' }, { label: 'Países', path: '/app/countries', icon: 'public' });
    if (role === 'ADMIN' || role === 'TAX_MANAGER') adminLinks.push({ label: 'Auditoría', path: '/app/audit-logs', icon: 'history' });
    if (adminLinks.length) this.navGroups.push({ label: 'Administración', links: adminLinks });

    this.notificationsApi.refreshUnreadCount();
    this.updateSectionTitle();
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.notificationsApi.refreshUnreadCount();
      this.updateSectionTitle();
    });
  }

  closeOnMobile(drawer: MatSidenav): void {
    if (this.isMobile()) void drawer.close();
  }

  loadNotifications(): void {
    this.notificationsLoading.set(true);
    this.notificationError.set('');
    this.notificationsApi.list({ page: 1, limit: 6 }).pipe(
      finalize(() => this.notificationsLoading.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (page) => this.recentNotifications.set(page.data),
      error: () => this.notificationError.set('No se pudieron cargar los avisos.'),
    });
  }

  openNotification(item: TaxNotification): void {
    if (item.isRead) { this.navigateTo(item); return; }
    this.notificationsApi.markRead(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.recentNotifications.update((items) => items.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
        this.notificationsApi.refreshUnreadCount();
        this.navigateTo(item);
      },
      error: () => this.notificationError.set('No se pudo marcar el aviso como leído.'),
    });
  }

  markAllNotificationsRead(): void {
    this.notificationsApi.markAllRead().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.recentNotifications.update((items) => items.map((entry) => ({ ...entry, isRead: true })));
        this.notificationsApi.refreshUnreadCount();
      },
      error: () => this.notificationError.set('No se pudieron actualizar los avisos.'),
    });
  }

  private navigateTo(item: TaxNotification): void {
    void this.router.navigate(item.taxObligation ? ['/app/tax-obligations', item.taxObligation.id] : ['/app/notifications']);
  }

  /** Section name for the top bar, taken from the deepest active route's `data.section`. */
  private updateSectionTitle(): void {
    let snapshot = this.router.routerState.snapshot.root;
    while (snapshot.firstChild) snapshot = snapshot.firstChild;
    this.sectionTitle.set((snapshot.data['section'] as string | undefined) ?? '');
  }
}
