import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { apiErrorMessage } from '../errors/api-error-message';

/** Single place for transient success/error messages, so every screen gives the same kind of feedback. */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: 3500, panelClass: 'tf-snack-success', politeness: 'polite' });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: 6000, panelClass: 'tf-snack-error', politeness: 'assertive' });
  }

  /** Shows the API's explanation when it has one, otherwise the given fallback. */
  apiError(error: unknown, fallback: string): void {
    this.error(apiErrorMessage(error, fallback));
  }
}
