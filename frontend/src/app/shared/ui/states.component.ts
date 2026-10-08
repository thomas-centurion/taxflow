import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Intentional empty state: what is missing and, through projected content, what to do next. */
@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state" [class.compact]="compact()">
      <mat-icon class="icon" aria-hidden="true">{{ icon() }}</mat-icon>
      <strong>{{ title() }}</strong>
      @if (message()) { <p>{{ message() }}</p> }
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 40px 24px; text-align: center; }
    .state.compact { padding: 24px 16px; }
    .icon { margin-bottom: 4px; color: var(--tf-ink-400); font-size: 24px; width: 24px; height: 24px; }
    strong { font-size: var(--tf-text-body); font-weight: 600; color: var(--tf-ink-900); }
    p { margin: 0; max-width: 420px; font-size: var(--tf-text-sm); color: var(--tf-ink-500); }
    .actions { margin-top: 10px; display: flex; gap: 8px; }
    .actions:empty { display: none; }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly message = input('');
  readonly compact = input(false);
}

/** Recoverable error with a retry action. */
@Component({
  selector: 'app-error-state',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tf-notice" data-tone="danger" role="alert">
      <mat-icon aria-hidden="true">error</mat-icon>
      <span>{{ message() }}</span>
      <span class="tf-notice-actions"><button mat-stroked-button type="button" (click)="retry.emit()">Reintentar</button></span>
    </div>
  `,
  styles: `:host { display: block; margin: 12px 16px; }`,
})
export class ErrorStateComponent {
  readonly message = input.required<string>();
  readonly retry = output<void>();
}

/** Skeleton rows shown while a list loads, so the page never looks frozen or empty. */
@Component({
  selector: 'app-loading-rows',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rows" role="status" [attr.aria-label]="label()">
      @for (row of placeholders(); track $index) {
        <div class="row"><span class="a"></span><span class="b"></span><span class="c"></span></div>
      }
      <span class="tf-visually-hidden">{{ label() }}</span>
    </div>
  `,
  styles: `
    .rows { padding: 0 16px 8px; }
    .row { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 24px; align-items: center; height: 48px; border-bottom: 1px solid var(--tf-line-soft); }
    .row:last-child { border-bottom: 0; }
    span:not(.tf-visually-hidden) { height: 8px; border-radius: 2px; background: var(--tf-line-soft); animation: pulse 1.6s ease-in-out infinite; }
    .a { width: 60%; } .b { width: 45%; } .c { width: 30%; }
    @keyframes pulse { 50% { opacity: .5; } }
    @media (prefers-reduced-motion: reduce) { span { animation: none !important; } }
  `,
})
export class LoadingRowsComponent {
  readonly label = input('Cargando…');
  readonly rows = input(5);
  protected readonly placeholders = computed(() => PLACEHOLDERS.slice(0, this.rows()));
}

const PLACEHOLDERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
