import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Standard page heading: section eyebrow, title, short description and projected actions. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="copy">
        @if (eyebrow()) { <p class="eyebrow">{{ eyebrow() }}</p> }
        <h1>{{ title() }}</h1>
        @if (subtitle()) { <p class="subtitle">{{ subtitle() }}</p> }
        <ng-content select="[headerMeta]" />
      </div>
      <div class="actions"><ng-content /></div>
    </header>
  `,
  styles: `
    .page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap; margin: 0 0 20px; }
    .copy { min-width: 0; }
    .eyebrow { margin: 0 0 4px; font-size: 12px; font-weight: 600; color: var(--tf-primary); }
    h1 { margin: 0; font-size: 26px; line-height: 1.2; font-weight: 700; letter-spacing: -.02em; overflow-wrap: anywhere; }
    .subtitle { margin: 6px 0 0; font-size: 14px; color: var(--tf-ink-500); max-width: 680px; }
    .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .actions:empty { display: none; }
    @media (max-width: 600px) { h1 { font-size: 22px; } .actions { width: 100%; } }
  `,
})
export class PageHeaderComponent {
  readonly eyebrow = input<string>('');
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
