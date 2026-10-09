import { DestroyRef, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialogRef } from '@angular/material/dialog';
import { Observable, finalize } from 'rxjs';
import { apiErrorMessage } from '../../core/errors/api-error-message';

export interface DialogSaveState {
  saving: WritableSignal<boolean>;
  error: WritableSignal<string>;
}

export function saveFromDialog<T>(
  request: Observable<T>,
  dialogRef: MatDialogRef<unknown, T>,
  state: DialogSaveState,
  destroyRef: DestroyRef,
  fallbackError: string,
): void {
  state.saving.set(true);
  state.error.set('');
  dialogRef.disableClose = true;
  request.pipe(
    finalize(() => { state.saving.set(false); dialogRef.disableClose = false; }),
    takeUntilDestroyed(destroyRef),
  ).subscribe({
    next: (saved) => dialogRef.close(saved),
    error: (error: unknown) => state.error.set(apiErrorMessage(error, fallbackError)),
  });
}
