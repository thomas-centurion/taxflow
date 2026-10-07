import { AuditLog } from '../shared/models/audit-log.model';
import { TaxObligationStatus, TaxObligationType } from '../shared/models/tax-obligation.model';
import { UserRole } from '../shared/models/user.model';
import { calendarDate, fileSize } from '../shared/presentation/format';
import { fieldLabel, roleLabel, statusLabel, typeLabel } from '../shared/presentation/labels';

export interface AuditChange { field: string; label: string; before: string; after: string }

type Change = { before?: unknown; after?: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Readable value for a metadata field (enum labels, booleans, dates, sizes, short IDs). */
export function auditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string') {
    if (field === 'status') return statusLabel(value as TaxObligationStatus);
    if (field === 'type') return typeLabel(value as TaxObligationType);
    if (field === 'role') return roleLabel(value as UserRole);
    if (field === 'dueDate' && /^\d{4}-\d{2}-\d{2}/.test(value)) return calendarDate(value);
    if (UUID.test(value)) return `ID …${value.slice(-6)}`;
    return value;
  }
  if (typeof value === 'number') return field === 'size' ? fileSize(value) : String(value);
  return JSON.stringify(value);
}

export function auditActor(log: AuditLog): string {
  if (log.actorType === 'SYSTEM') return 'Sistema (automatización)';
  if (log.actor) return `${log.actor.firstName} ${log.actor.lastName}`;
  if (log.actorEmail) return log.actorEmail;
  return log.action === 'LOGIN_FAILED' ? 'Sin sesión' : 'Usuario eliminado';
}

export function auditChanges(log: AuditLog): AuditChange[] {
  const changes = log.metadata?.['changes'];
  if (!changes || typeof changes !== 'object') return [];
  return Object.entries(changes as Record<string, Change>).map(([field, change]) => ({
    field,
    label: fieldLabel(field),
    before: auditValue(field, change.before),
    after: auditValue(field, change.after),
  }));
}

/** Remaining metadata (created/deleted values or event details) as label/value pairs. */
export function auditDetails(log: AuditLog): { label: string; value: string }[] {
  const metadata = log.metadata ?? {};
  const source = (metadata['values'] && typeof metadata['values'] === 'object')
    ? metadata['values'] as Record<string, unknown>
    : Object.fromEntries(Object.entries(metadata).filter(([key]) => key !== 'changes'));
  return Object.entries(source)
    .filter(([key]) => key !== 'changes')
    .map(([key, value]) => ({ label: fieldLabel(key), value: auditValue(key, value) }));
}

/** One-line description for the table. */
export function auditSummary(log: AuditLog): string {
  const changes = auditChanges(log);
  if (changes.length) {
    const shown = changes.slice(0, 2).map((change) => `${change.label}: ${change.before} → ${change.after}`).join(' · ');
    return changes.length > 2 ? `${shown} · y ${changes.length - 2} más` : shown;
  }
  const metadata = log.metadata ?? {};
  const values = metadata['values'] as Record<string, unknown> | undefined;
  const name = values?.['name'] ?? (values?.['firstName'] ? `${String(values['firstName'])} ${String(values['lastName'] ?? '')}` : undefined);
  return String(name ?? metadata['originalFilename'] ?? metadata['title'] ?? metadata['email'] ?? '—');
}
