import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { NotificationsApiService } from '../core/services/notifications-api.service';
import { apiErrorMessage } from '../core/errors/api-error-message';
import { TaxNotification } from '../shared/models/notification.model';

@Component({
  selector: 'app-notifications-page', standalone: true,
  imports: [CommonModule, DatePipe, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  template: `
    <header class="page-head"><div><p class="eyebrow">CENTRO DE AVISOS</p><h1>Notificaciones</h1><p class="intro">Avisos de vencimientos, documentos y cambios en tus obligaciones.</p></div>
      <div class="head-actions"><button mat-stroked-button type="button" (click)="load()" [disabled]="loading"><mat-icon>refresh</mat-icon> Actualizar</button>
      <button mat-flat-button color="primary" type="button" (click)="markAllRead()" [disabled]="loading || unreadCount === 0">Marcar todas leídas</button></div></header>
    <mat-progress-bar *ngIf="loading" mode="indeterminate" />
    <section *ngIf="error" class="error" role="alert"><mat-icon>error_outline</mat-icon><span>{{ error }}</span><button mat-button (click)="load()">Reintentar</button></section>
    <mat-card class="list-card"><div class="list-head"><strong>{{ unreadCount }} sin leer</strong><span>{{ total }} notificaciones</span></div>
      <button class="notification-row" *ngFor="let item of notifications" type="button" [class.unread]="!item.isRead" (click)="open(item)">
        <span class="icon"><mat-icon>{{ iconFor(item.type) }}</mat-icon></span><span class="copy"><strong>{{ item.title }}</strong><span>{{ item.message }}</span>
          <small>{{ item.createdAt | date:'dd/MM/yyyy HH:mm' }}<span *ngIf="item.taxObligation"> · {{ item.taxObligation.name }}</span></small></span>
        <mat-icon *ngIf="!item.isRead" class="unread-dot">fiber_manual_record</mat-icon>
        <mat-icon *ngIf="item.taxObligation" class="open-icon">open_in_new</mat-icon>
      </button>
      <div *ngIf="!loading && !error && notifications.length === 0" class="empty"><mat-icon>notifications_none</mat-icon><strong>No hay notificaciones</strong><span>Los avisos para este usuario aparecerán acá.</span></div>
    </mat-card>
  `,
  styles: [`
    :host{display:block}.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px}.eyebrow{font-size:10px;color:#8290a0;font-weight:700;letter-spacing:.12em;margin:0 0 7px}.page-head h1{font-size:26px;color:#293b50;margin:0}.intro{font-size:13px;color:#7d8998;margin:8px 0 0}.head-actions{display:flex;gap:10px}.head-actions mat-icon{font-size:18px}.list-card{padding:0 18px}.list-head{height:54px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e8edf2;font-size:12px;color:#788596}.list-head strong{color:#34475d}.notification-row{width:100%;display:flex;align-items:center;gap:14px;padding:15px 4px;text-align:left;border:0;border-bottom:1px solid #edf0f4;background:#fff;color:#34475d;cursor:pointer}.notification-row:last-of-type{border-bottom:0}.notification-row:hover{background:#f8fafc}.notification-row.unread{background:#f5f8fc}.icon{width:36px;height:36px;flex:none;display:grid;place-items:center;background:#edf3fb;color:#3e6fa8;border-radius:50%}.icon mat-icon{font-size:19px}.copy{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}.copy strong{font-size:13px;font-weight:650}.copy>span{font-size:12px;line-height:1.45;color:#536276}.copy small{font-size:10px;color:#8b97a5}.unread-dot{font-size:10px;color:#3478bd;width:12px;height:12px}.open-icon{font-size:17px;color:#8a97a6}.empty{min-height:220px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px;color:#8995a3;font-size:12px}.empty mat-icon{font-size:30px;width:30px;height:30px}.empty strong{color:#526277;font-size:14px}.error{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:14px;border:1px solid #edcccc;border-radius:8px;color:#873f3f;background:#fffafa;font-size:13px}.error button{margin-left:auto}
    @media(max-width:700px){.page-head{align-items:flex-start;flex-direction:column}.head-actions{width:100%;flex-wrap:wrap}.page-head h1{font-size:23px}.list-card{padding:0 10px}.notification-row{gap:9px}.copy>span{overflow-wrap:anywhere}}
  `],
})
export class NotificationsPageComponent {
  private readonly api = inject(NotificationsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snack = inject(MatSnackBar);
  notifications: TaxNotification[] = [];
  unreadCount = 0;
  total = 0;
  loading = false;
  error = '';

  constructor() { this.load(); }

  load(): void {
    this.loading = true; this.error = '';
    forkJoin({ page: this.api.list({ page: 1, limit: 50 }), unreadCount: this.api.unreadCount() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ page, unreadCount }) => { this.notifications = page.data; this.total = page.meta.total; this.unreadCount = unreadCount; this.loading = false; },
      error: (error: unknown) => { this.loading = false; this.error = apiErrorMessage(error, 'No se pudieron cargar las notificaciones.'); },
    });
  }

  markAllRead(): void {
    this.api.markAllRead().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.notifications = this.notifications.map((item) => ({ ...item, isRead: true })); this.unreadCount = 0; this.api.refreshUnreadCount(); this.snack.open('Notificaciones marcadas como leídas.', 'Cerrar', { duration: 3000 }); },
      error: (error: unknown) => this.snack.open(apiErrorMessage(error, 'No se pudieron actualizar las notificaciones.'), 'Cerrar', { duration: 4000 }),
    });
  }

  open(item: TaxNotification): void {
    const navigate = (): void => { if (item.taxObligation) void this.router.navigate(['/app/tax-obligations', item.taxObligation.id]); };
    if (item.isRead) { navigate(); return; }
    this.api.markRead(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { item.isRead = true; this.unreadCount = Math.max(0, this.unreadCount - 1); navigate(); },
      error: (error: unknown) => this.snack.open(apiErrorMessage(error, 'No se pudo marcar la notificación como leída.'), 'Cerrar', { duration: 4000 }),
    });
  }

  iconFor(type: TaxNotification['type']): string { return type === 'DEADLINE' ? 'event' : type === 'DOCUMENT' ? 'description' : type === 'AUTOMATION' ? 'autorenew' : 'info'; }
}
