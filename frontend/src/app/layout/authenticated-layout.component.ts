import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';

import { Component, DestroyRef, HostListener, inject } from '@angular/core';

import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { filter } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';

import { MatBadgeModule } from '@angular/material/badge';

import { MatIconModule } from '@angular/material/icon';

import { MatListModule } from '@angular/material/list';

import { MatMenuModule } from '@angular/material/menu';

import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';

import { MatToolbarModule } from '@angular/material/toolbar';

import { AuthService } from '../core/auth/auth.service';

import { NotificationsApiService } from '../core/services/notifications-api.service';

import { TaxNotification } from '../shared/models/notification.model';

import { UserRole } from '../shared/models/user.model';


interface NavLink {
  label: string;
  path: string;
  icon: string;
}


@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [
    AsyncPipe,
    CommonModule,
    DatePipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
  ],
  template: `
    <mat-sidenav-container class="app-container">

      <mat-sidenav
        #drawer
        class="sidebar"
        [mode]="isMobile ? 'over' : 'side'"
        [opened]="!isMobile"
      >
        <a class="brand" routerLink="/app">
          <span class="brand-icon">
            <mat-icon>account_balance</mat-icon>
          </span>

          <span>TaxFlow</span>
        </a>

        <div class="nav-caption">GESTIÓN</div>

        <mat-nav-list>
          <a
            mat-list-item
            *ngFor="let item of links"
            [routerLink]="item.path"
            routerLinkActive="active-link"
            (click)="closeOnMobile(drawer)"
          >
            <mat-icon matListItemIcon>
              {{ item.icon }}
            </mat-icon>

            <span matListItemTitle>
              {{ item.label }}
            </span>
          </a>
        </mat-nav-list>

        <div class="sidebar-foot">
          Fiscal operations
          <br>
          <span>Workspace local</span>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>

        <mat-toolbar class="topbar">

          <button
            mat-icon-button
            class="mobile-menu"
            aria-label="Abrir navegación"
            (click)="drawer.toggle()"
          >
            <mat-icon>menu</mat-icon>
          </button>

          <span class="topbar-title">Tax operations</span>

          <span class="spacer"></span>

          <button
            mat-icon-button
            class="notification-button"
            aria-label="Notificaciones"
            [matMenuTriggerFor]="notificationMenu"
            [matBadge]="unreadCount || null"
            [matBadgeHidden]="unreadCount === 0"
            matBadgeColor="warn"
            matBadgeSize="small"
            (menuOpened)="loadNotifications()"
          >
            <mat-icon>notifications</mat-icon>
          </button>

          <mat-menu
            #notificationMenu="matMenu"
            class="notification-menu"
          >
            <div
              class="notification-menu-head"
              (click)="$event.stopPropagation()"
            >
              <strong>Notificaciones</strong>

              <a routerLink="/app/notifications">
                Ver todas
              </a>
            </div>

            <button
              mat-menu-item
              *ngFor="let item of recentNotifications"
              (click)="openNotification(item)"
              [class.unread-item]="!item.isRead"
            >
              <mat-icon>
                {{
                  item.type === 'DEADLINE'
                    ? 'event'
                    : item.type === 'DOCUMENT'
                      ? 'description'
                      : 'info'
                }}
              </mat-icon>

              <span class="menu-copy">
                <strong>{{ item.title }}</strong>

                <small>{{ item.message }}</small>

                <small class="menu-date">
                  {{ item.createdAt | date:'dd/MM HH:mm' }}
                </small>
              </span>
            </button>

            <div
              *ngIf="recentNotifications.length === 0 && !notificationsLoading"
              class="menu-empty"
            >
              {{ notificationError || 'No hay notificaciones recientes.' }}
            </div>

            <div
              *ngIf="notificationsLoading"
              class="menu-empty"
            >
              Cargando…
            </div>

            <button
              *ngIf="unreadCount > 0"
              mat-menu-item
              (click)="markAllNotificationsRead()"
            >
              <mat-icon>done_all</mat-icon>

              <span>Marcar todas como leídas</span>
            </button>
          </mat-menu>

          <div
            class="user-block"
            *ngIf="auth.user$ | async as user"
          >
            <span class="user-avatar">
              {{ user.firstName.slice(0, 1) }}{{ user.lastName.slice(0, 1) }}
            </span>

            <span class="user-copy">
              <strong>
                {{ user.firstName }} {{ user.lastName }}
              </strong>

              <small>
                {{ roleName(user.role) }}
              </small>
            </span>
          </div>

          <button
            mat-button
            class="logout"
            (click)="auth.logout()"
          >
            <mat-icon>logout</mat-icon>
            <span>Salir</span>
          </button>

        </mat-toolbar>

        <main class="page-content">
          <router-outlet />
        </main>

      </mat-sidenav-content>

    </mat-sidenav-container>
  `,
  styles: [`
    :host,
    .app-container {
      display: block;
      height: 100vh;
    }

    .sidebar {
      width: 248px;
      background: #fff;
      border-right: 1px solid #e2e7ed;
    }

    .brand {
      height: 76px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 24px;
      text-decoration: none;
      color: #1d3045;
      font-weight: 700;
      font-size: 19px;
    }

    .brand-icon {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 9px;
      background: #eaf1fb;
      color: #2764ad;
    }

    .nav-caption {
      padding: 18px 24px 8px;
      color: #8491a1;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .12em;
    }

    .active-link {
      background: #edf3fb !important;
      color: #245fa7 !important;
      border-radius: 8px;
    }

    .active-link mat-icon {
      color: #245fa7;
    }

    .sidebar-foot {
      position: absolute;
      bottom: 20px;
      left: 24px;
      color: #607085;
      font-size: 12px;
      line-height: 1.6;
    }

    .sidebar-foot span {
      color: #9aa4b0;
    }

    .topbar {
      height: 68px;
      background: #fff;
      border-bottom: 1px solid #e2e7ed;
      color: #29394b;
    }

    .topbar-title {
      font-size: 14px;
      font-weight: 600;
    }

    .spacer {
      flex: 1;
    }

    .notification-button {
      margin-right: 14px;
      color: #536477;
    }

    .notification-menu-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      font-size: 13px;
      color: #34475d;
    }

    .notification-menu-head a {
      font-size: 11px;
      color: #2d68a8;
      text-decoration: none;
    }

    .menu-copy {
      display: flex;
      flex-direction: column;
      max-width: 260px;
      line-height: 1.35;
    }

    .menu-copy strong {
      font-size: 12px;
    }

    .menu-copy small {
      font-size: 10px;
      color: #718093;
      white-space: normal;
    }

    .menu-copy .menu-date {
      font-size: 9px;
      color: #9aa4b0;
    }

    .unread-item {
      background: #f1f6fc;
    }

    .menu-empty {
      padding: 20px 16px;
      color: #8491a1;
      font-size: 12px;
    }

    .user-block {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-right: 12px;
    }

    .user-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: #e9eff7;
      color: #305d91;
      font-size: 12px;
      font-weight: 700;
    }

    .user-copy {
      display: flex;
      flex-direction: column;
      line-height: 1.4;
    }

    .user-copy strong {
      font-size: 12px;
      font-weight: 600;
    }

    .user-copy small {
      font-size: 11px;
      color: #788596;
    }

    .logout {
      color: #536477;
    }

    .logout mat-icon {
      font-size: 19px;
      width: 19px;
      height: 19px;
      margin-right: 4px;
    }

    .page-content {
      max-width: 1440px;
      margin: 0 auto;
      padding: 30px 36px 56px;
    }

    .mobile-menu {
      display: none;
    }

    @media (max-width: 760px) {
      .sidebar {
        width: 270px;
      }

      .mobile-menu {
        display: inline-flex;
        margin-right: 8px;
      }

      .page-content {
        padding: 22px 16px 40px;
      }

      .topbar-title {
        display: none;
      }

      .user-copy {
        display: none;
      }

      .logout span {
        display: none;
      }
    }
  `],
})
export class AuthenticatedLayoutComponent {

  readonly auth = inject(AuthService);

  private readonly notificationsApi = inject(NotificationsApiService);

  private readonly router = inject(Router);

  private readonly destroyRef = inject(DestroyRef);

  unreadCount = 0;

  recentNotifications: TaxNotification[] = [];

  notificationsLoading = false;

  notificationError = '';

  isMobile = window.matchMedia('(max-width: 760px)').matches;

  readonly links: NavLink[] = [];

  constructor() {

    this.links.push(
      {
        label: 'Inicio',
        path: '/app',
        icon: 'home',
      },
      {
        label: 'Empresas',
        path: '/app/companies',
        icon: 'business',
      },
      {
        label: 'Obligaciones fiscales',
        path: '/app/tax-obligations',
        icon: 'assignment',
      },
      {
        label: 'Notificaciones',
        path: '/app/notifications',
        icon: 'notifications',
      },
    );

    const role = this.auth.currentUser?.role;

    if (role === 'ADMIN') {
      this.links.push(
        {
          label: 'Usuarios',
          path: '/app/users',
          icon: 'group',
        },
        {
          label: 'Países',
          path: '/app/countries',
          icon: 'public',
        },
      );
    }

    if (role === 'ADMIN' || role === 'TAX_MANAGER') {
      this.links.push({
        label: 'Auditoría',
        path: '/app/audit-logs',
        icon: 'history',
      });
    }

    this.refreshUnreadCount();

    this.notificationsApi.unreadCount$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((count) => {
        this.unreadCount = count;
      });

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd =>
            event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.refreshUnreadCount();
      });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile = window.matchMedia('(max-width: 760px)').matches;
  }

  closeOnMobile(drawer: MatSidenav): void {
    if (this.isMobile) {
      void drawer.close();
    }
  }

  refreshUnreadCount(): void {
    this.notificationsApi.refreshUnreadCount();
  }

  loadNotifications(): void {
    this.notificationsLoading = true;
    this.notificationError = '';

    this.notificationsApi
      .list({
        page: 1,
        limit: 5,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (page) => {
          this.recentNotifications = page.data;
          this.notificationsLoading = false;
          this.refreshUnreadCount();
        },

        error: () => {
          this.notificationsLoading = false;
          this.notificationError =
            'No se pudieron cargar los avisos.';
        },
      });
  }

  openNotification(item: TaxNotification): void {

    if (item.isRead) {
      this.navigateNotification(item);
      return;
    }

    this.notificationsApi
      .markRead(item.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          item.isRead = true;
          this.unreadCount = Math.max(
            0,
            this.unreadCount - 1,
          );

          this.navigateNotification(item);
        },

        error: () => {
          this.notificationError =
            'No se pudo marcar como leída.';
        },
      });
  }

  markAllNotificationsRead(): void {

    this.notificationsApi
      .markAllRead()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.unreadCount = 0;

          this.recentNotifications =
            this.recentNotifications.map((item) => ({
              ...item,
              isRead: true,
            }));
        },

        error: () => {
          this.notificationError =
            'No se pudieron actualizar los avisos.';
        },
      });
  }

  private navigateNotification(item: TaxNotification): void {
    void this.router.navigate(
      item.taxObligation
        ? ['/app/tax-obligations', item.taxObligation.id]
        : ['/app/notifications'],
    );
  }

  roleName(role: UserRole): string {
    return role === 'ADMIN'
      ? 'Administrador'
      : role === 'TAX_MANAGER'
        ? 'Responsable fiscal'
        : 'Analista';
  }
}