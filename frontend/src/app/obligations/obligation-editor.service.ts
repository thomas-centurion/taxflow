import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { EMPTY, Observable, filter, forkJoin, switchMap, tap } from 'rxjs';
import { FeedbackService } from '../core/feedback/feedback.service';
import { CompaniesApiService } from '../core/services/companies-api.service';
import { NotificationsApiService } from '../core/services/notifications-api.service';
import { TaxObligationsApiService } from '../core/services/tax-obligations-api.service';
import { UsersApiService } from '../core/services/users-api.service';
import { TaxObligation } from '../shared/models/tax-obligation.model';
import { ObligationFormDialogComponent, ObligationFormDialogData } from './obligation-form-dialog/obligation-form-dialog.component';

@Injectable({ providedIn: 'root' })
export class ObligationEditorService {
  private readonly dialog = inject(MatDialog);
  private readonly obligationsApi = inject(TaxObligationsApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly notificationsApi = inject(NotificationsApiService);
  private readonly feedback = inject(FeedbackService);

  open(record?: TaxObligation): Observable<TaxObligation> {
    return forkJoin({ companies: this.companiesApi.list(1, 100), users: this.usersApi.options() }).pipe(
      switchMap(({ companies, users }) => {
        const activeCompanies = companies.data.filter((company) => company.isActive);
        if (!record && !activeCompanies.length) {
          this.feedback.error('Para registrar una obligación primero necesitás una empresa activa.');
          return EMPTY;
        }
        const data: ObligationFormDialogData = {
          record,
          companies: activeCompanies,
          users,
          save: (input) => (record ? this.obligationsApi.update(record.id, input) : this.obligationsApi.create(input)),
        };
        return this.dialog.open<ObligationFormDialogComponent, ObligationFormDialogData, TaxObligation>(ObligationFormDialogComponent, {
          data, width: '720px', maxWidth: '96vw', autoFocus: 'first-tabbable', restoreFocus: true,
        }).afterClosed();
      }),
      filter((saved): saved is TaxObligation => !!saved),
      tap((saved) => {
        this.feedback.success(record ? `Se guardaron los cambios de "${saved.name}".` : `Se creó la obligación "${saved.name}".`);
        this.notificationsApi.refreshUnreadCount();
      }),
    );
  }
}
