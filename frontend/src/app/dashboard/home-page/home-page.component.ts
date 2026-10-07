import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, map, of, scan, startWith, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { personName } from '../../shared/presentation/format';
import { typeLabel } from '../../shared/presentation/labels';
import { DueDateComponent } from '../../shared/ui/due-date.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { DashboardDataService } from '../dashboard-data.service';
import { DashboardMetrics, buildDashboardMetrics } from '../dashboard-metrics';

interface DashboardState { loading: boolean; error: boolean; metrics?: DashboardMetrics }

@Component({
  selector: 'app-home-page',
  imports: [AsyncPipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule, DueDateComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, StatusBadgeComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  private readonly dataService = inject(DashboardDataService);
  readonly firstName = inject(AuthService).currentUser?.firstName ?? '';
  readonly personName = personName;
  readonly typeLabel = typeLabel;

  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  /** Previous figures stay visible while refreshing, so the page never flashes empty. */
  readonly state$ = this.refresh$.pipe(
    switchMap(() => this.dataService.load().pipe(
      map((raw): DashboardState => ({ loading: false, error: false, metrics: buildDashboardMetrics(raw.companies, raw.obligations) })),
      catchError(() => of<DashboardState>({ loading: false, error: true })),
      startWith<DashboardState>({ loading: true, error: false }),
    )),
    scan((previous, next) => (next.loading ? { ...previous, loading: true, error: false } : next), { loading: true, error: false } as DashboardState),
  );

  refresh(): void { this.refresh$.next(); }

  /** Brings the overdue panel into view and moves focus there (the page scrolls inside the layout, not the window). */
  focusOverdue(): void {
    const panel = document.getElementById('overdue-panel');
    panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panel?.focus({ preventScroll: true });
  }
}
