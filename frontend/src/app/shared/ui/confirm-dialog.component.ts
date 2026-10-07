import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogConfig, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Observable, filter, map } from 'rxjs';

export interface ConfirmDialogData {
  title: string;
  /** What will happen, in plain words. */
  message: string;
  /** Name of the affected record, shown emphasized. */
  subject?: string;
  confirmLabel: string;
  /** Destructive actions use the danger color and remind that they cannot be undone. */
  destructive?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      @if (data.destructive) { <mat-icon class="warn-icon" aria-hidden="true">warning</mat-icon> }
      {{ data.title }}
    </h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      @if (data.subject) { <p class="subject">{{ data.subject }}</p> }
      @if (data.destructive) { <p class="irreversible">Esta acción no se puede deshacer.</p> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Cancelar</button>
      <button mat-flat-button type="button" [class.tf-danger]="data.destructive" [mat-dialog-close]="true">{{ data.confirmLabel }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    h2 { display: flex; align-items: center; gap: 10px; }
    .warn-icon { color: var(--tf-danger); }
    p { margin: 0 0 10px; color: var(--tf-ink-700); }
    .subject { padding: 10px 12px; border-radius: var(--tf-radius-sm); background: var(--tf-surface-muted); border: 1px solid var(--tf-line); font-weight: 600; color: var(--tf-ink-900); overflow-wrap: anywhere; }
    .irreversible { font-size: 13px; color: var(--tf-ink-500); }
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}

/** Opens a confirmation dialog and emits once, only if the user confirmed. */
export function confirmAction(dialog: MatDialog, data: ConfirmDialogData): Observable<true> {
  const config: MatDialogConfig<ConfirmDialogData> = { data, width: '440px', maxWidth: '94vw', autoFocus: 'first-tabbable', restoreFocus: true };
  return dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, config)
    .afterClosed()
    .pipe(filter((confirmed) => confirmed === true), map(() => true as const));
}
