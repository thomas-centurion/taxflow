import { TaxObligationStatus } from './tax-obligation-status.enum';

const { PENDING, IN_PROGRESS, SUBMITTED, APPROVED, OVERDUE, CANCELLED } = TaxObligationStatus;

/** Statuses that become overdue once their due date has passed. */
export const OVERDUE_ELIGIBLE_STATUSES: readonly TaxObligationStatus[] = [PENDING, IN_PROGRESS];

/** Manual status transitions accepted by the API. APPROVED and CANCELLED are final. */
export const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<TaxObligationStatus, readonly TaxObligationStatus[]>> = {
  [PENDING]: [IN_PROGRESS, SUBMITTED, OVERDUE, CANCELLED],
  [IN_PROGRESS]: [PENDING, SUBMITTED, OVERDUE, CANCELLED],
  [OVERDUE]: [PENDING, IN_PROGRESS, SUBMITTED, CANCELLED],
  [SUBMITTED]: [IN_PROGRESS, APPROVED],
  [APPROVED]: [],
  [CANCELLED]: [],
};

/** Current date as YYYY-MM-DD in the backend process timezone (same reference used by the deadline scheduler). */
export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** True when an active obligation has passed its due date and must transition to OVERDUE. */
export function shouldBecomeOverdue(status: TaxObligationStatus, dueDate: string, today: string): boolean {
  return OVERDUE_ELIGIBLE_STATUSES.includes(status) && dueDate < today;
}

/** Single business definition of an overdue obligation. */
export function isOverdue(status: TaxObligationStatus, dueDate: string, today: string): boolean {
  return status === OVERDUE || shouldBecomeOverdue(status, dueDate, today);
}

/** Returns a reason when the resulting status/due date combination is not allowed, or null when it is valid. */
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
