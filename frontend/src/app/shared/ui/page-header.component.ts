import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="copy">
        <h1>{{ title() }}</h1>
        @if (subtitle()) { <p class="subtitle">{{ subtitle() }}</p> }
        <ng-content select="[headerMeta]" />
      </div>
      <div class="actions"><ng-content /></div>
    </header>
  `,
  styles: `
    .page-header { display: flex; align-items: center; justify-content: space-between; gap: 12px 24px; flex-wrap: wrap; margin: 0 0 16px; }
    .copy { min-width: 0; }
    h1 { margin: 0; font-size: var(--tf-text-title); line-height: 28px; font-weight: 600; overflow-wrap: anywhere; }
    .subtitle { margin: 2px 0 0; font-size: var(--tf-text-sm); color: var(--tf-ink-500); max-width: 680px; }
    .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .actions:empty { display: none; }
    @media (max-width: 600px) { h1 { font-size: 18px; } }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
