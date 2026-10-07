import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TaxObligationStatus } from '../models/tax-obligation.model';
import { OBLIGATION_STATUS } from '../presentation/labels';

/** Status pill for a tax obligation, with the meaning of the status as a tooltip. */
@Component({
  selector: 'app-status-badge',
  imports: [MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="tf-badge" [attr.data-tone]="meta().tone" [matTooltip]="meta().description">{{ meta().label }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<TaxObligationStatus>();
  protected readonly meta = computed(() => OBLIGATION_STATUS[this.status()]);
}
