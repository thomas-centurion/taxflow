import { TaxObligationStatus } from './tax-obligation.model';

export type AutomationRunStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type AutomationRunTrigger = 'MANUAL' | 'SCHEDULED';
export type AutomationErrorCode = 'OBLIGATION_NOT_FOUND' | 'NOT_PROCESSABLE' | 'INTERRUPTED' | 'INTERNAL_ERROR';

export interface AutomationRun {
  id: string;
  taxObligationId: string;
  trigger: AutomationRunTrigger;
  status: AutomationRunStatus;
  requestedBy: { id: string; firstName: string; lastName: string } | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: AutomationErrorCode | null;
  errorMessage: string | null;
  result: {
    previousStatus?: TaxObligationStatus;
    status?: TaxObligationStatus;
    dueDate?: string;
    daysUntilDue?: number;
    overdueMarked?: boolean;
    notificationsCreated?: number;
    withoutResponsible?: boolean;
    durationMs?: number;
  } | null;
  createdAt: string;
}
