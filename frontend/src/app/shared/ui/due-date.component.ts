import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TaxObligationStatus } from '../models/tax-obligation.model';
import { calendarDate, daysBetween, relativeDays, todayKey } from '../presentation/format';

const ACTIVE: TaxObligationStatus[] = ['PENDING', 'IN_PROGRESS', 'OVERDUE'];

/**
 * Due date with a relative hint ("en 3 días", "hace 2 días") for obligations that still need work.
 * Whether an obligation is overdue comes from the backend (`overdue` input); this only presents it.
 */
@Component({
  selector: 'app-due-date',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="due" [class.overdue]="overdue()" [class.soon]="soon()">
      <span class="date">{{ date() }}</span>
      @if (hint()) { <span class="hint">{{ hint() }}</span> }
    </span>
  `,
  styles: `
    .due { display: inline-flex; flex-direction: column; line-height: 1.3; }
    .date { font-variant-numeric: tabular-nums; color: var(--tf-ink-800); }
    .hint { font-size: 12px; color: var(--tf-ink-500); }
    .soon .hint { color: var(--tf-warning); font-weight: 600; }
    .overdue .date, .overdue .hint { color: var(--tf-danger); }
    .overdue .hint { font-weight: 600; }
  `,
})
export class DueDateComponent {
  readonly value = input.required<string>();
  readonly status = input.required<TaxObligationStatus>();
  readonly overdue = input(false);

  protected readonly date = computed(() => calendarDate(this.value()));
  private readonly active = computed(() => ACTIVE.includes(this.status()) || this.overdue());
  protected readonly hint = computed(() => {
    if (!this.active()) return '';
    const relative = relativeDays(this.value());
    return this.overdue() ? `Vencida ${relative === 'hoy' ? 'hoy' : relative}` : `Vence ${relative}`;
  });
  protected readonly soon = computed(() => {
    if (!this.active() || this.overdue()) return false;
    const days = daysBetween(todayKey(), this.value().slice(0, 10));
    return days >= 0 && days <= 7;
  });
}
