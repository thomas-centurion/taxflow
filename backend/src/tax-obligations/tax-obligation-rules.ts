import { TaxObligationStatus } from './tax-obligation-status.enum';

const { PENDING, IN_PROGRESS, SUBMITTED, APPROVED, OVERDUE, CANCELLED } = TaxObligationStatus;

export const OVERDUE_ELIGIBLE_STATUSES: readonly TaxObligationStatus[] = [PENDING, IN_PROGRESS];

export const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<TaxObligationStatus, readonly TaxObligationStatus[]>> = {
  [PENDING]: [IN_PROGRESS, SUBMITTED, OVERDUE, CANCELLED],
  [IN_PROGRESS]: [PENDING, SUBMITTED, OVERDUE, CANCELLED],
  [OVERDUE]: [PENDING, IN_PROGRESS, SUBMITTED, CANCELLED],
  [SUBMITTED]: [IN_PROGRESS, APPROVED],
  [APPROVED]: [],
  [CANCELLED]: [],
};

export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function shouldBecomeOverdue(status: TaxObligationStatus, dueDate: string, today: string): boolean {
  return OVERDUE_ELIGIBLE_STATUSES.includes(status) && dueDate < today;
}

export function isOverdue(status: TaxObligationStatus, dueDate: string, today: string): boolean {
  return status === OVERDUE || shouldBecomeOverdue(status, dueDate, today);
}

export function statusChangeError(
  previousStatus: TaxObligationStatus | null,
  nextStatus: TaxObligationStatus,
  dueDate: string,
  today: string,
): string | null {
  if (previousStatus && previousStatus !== nextStatus && !ALLOWED_STATUS_TRANSITIONS[previousStatus].includes(nextStatus)) {
    return `Invalid status transition from ${previousStatus} to ${nextStatus}.`;
  }
  if (nextStatus === OVERDUE && dueDate >= today) {
    return 'Only obligations with a past due date can be marked as OVERDUE.';
  }
  if (previousStatus === OVERDUE && OVERDUE_ELIGIBLE_STATUSES.includes(nextStatus) && dueDate < today) {
    return 'An overdue obligation can only be reopened after moving its due date to today or later.';
  }
  return null;
}
