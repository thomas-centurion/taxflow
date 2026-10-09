import { AuditAction } from '../models/audit-log.model';
import { AutomationErrorCode, AutomationRunStatus, AutomationRunTrigger } from '../models/automation-run.model';
import { NotificationType } from '../models/notification.model';
import { TaxObligationStatus, TaxObligationType } from '../models/tax-obligation.model';
import { UserRole } from '../models/user.model';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral';

export interface Option<T extends string> { value: T; label: string }

export const OBLIGATION_STATUS: Record<TaxObligationStatus, { label: string; tone: BadgeTone; description: string }> = {
  PENDING: { label: 'Pendiente', tone: 'warning', description: 'Todavía no se empezó a trabajar.' },
  IN_PROGRESS: { label: 'En curso', tone: 'info', description: 'Se está preparando la presentación.' },
  SUBMITTED: { label: 'Presentada', tone: 'violet', description: 'Presentada ante el organismo, pendiente de aprobación.' },
  APPROVED: { label: 'Aprobada', tone: 'success', description: 'Cumplida y aprobada.' },
  OVERDUE: { label: 'Vencida', tone: 'danger', description: 'Pasó la fecha de vencimiento sin presentarse.' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral', description: 'Ya no corresponde presentarla.' },
};

export const OBLIGATION_STATUS_OPTIONS: Option<TaxObligationStatus>[] =
  (Object.keys(OBLIGATION_STATUS) as TaxObligationStatus[]).map((value) => ({ value, label: OBLIGATION_STATUS[value].label }));

export const OBLIGATION_TYPE_LABELS: Record<TaxObligationType, string> = {
  VAT: 'IVA',
  INCOME_TAX: 'Impuesto a las ganancias',
  WITHHOLDING: 'Retenciones',
  PAYROLL_TAX: 'Impuesto sobre la nómina',
  OTHER: 'Otro',
};

export const OBLIGATION_TYPE_OPTIONS: Option<TaxObligationType>[] =
  (Object.keys(OBLIGATION_TYPE_LABELS) as TaxObligationType[]).map((value) => ({ value, label: OBLIGATION_TYPE_LABELS[value] }));

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  TAX_MANAGER: 'Responsable fiscal',
  ANALYST: 'Analista',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Acceso total, incluida la administración de usuarios y países.',
  TAX_MANAGER: 'Gestiona empresas, obligaciones y documentos; ve la auditoría de negocio.',
  ANALYST: 'Solo lectura.',
};

export const ROLE_OPTIONS: Option<UserRole>[] = (Object.keys(ROLE_LABELS) as UserRole[]).map((value) => ({ value, label: ROLE_LABELS[value] }));

export const AUDIT_ACTION: Record<AuditAction, { label: string; tone: BadgeTone }> = {
  CREATE: { label: 'Alta', tone: 'success' },
  UPDATE: { label: 'Modificación', tone: 'info' },
  DELETE: { label: 'Baja', tone: 'danger' },
  LOGIN: { label: 'Inicio de sesión', tone: 'neutral' },
  LOGIN_FAILED: { label: 'Inicio de sesión fallido', tone: 'warning' },
  LOGOUT: { label: 'Cierre de sesión', tone: 'neutral' },
  UPLOAD: { label: 'Carga de documento', tone: 'success' },
  DOWNLOAD: { label: 'Descarga de documento', tone: 'neutral' },
  MARK_READ: { label: 'Lectura de aviso', tone: 'neutral' },
  NOTIFICATION_CREATED: { label: 'Aviso generado', tone: 'violet' },
  AUTOMATION_STARTED: { label: 'Automatización iniciada', tone: 'info' },
  AUTOMATION_SUCCEEDED: { label: 'Automatización completada', tone: 'success' },
  AUTOMATION_FAILED: { label: 'Automatización fallida', tone: 'danger' },
};

export const AUDIT_ACTION_OPTIONS: Option<AuditAction>[] = (Object.keys(AUDIT_ACTION) as AuditAction[]).map((value) => ({ value, label: AUDIT_ACTION[value].label }));

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  User: 'Usuario',
  Company: 'Empresa',
  Country: 'País',
  TaxObligation: 'Obligación fiscal',
  Document: 'Documento',
  Notification: 'Notificación',
  AutomationRun: 'Ejecución automática',
};

export const AUDIT_ENTITY_OPTIONS: Option<string>[] = Object.entries(AUDIT_ENTITY_LABELS).map(([value, label]) => ({ value, label }));

export const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre', description: 'Descripción', status: 'Estado', type: 'Tipo', dueDate: 'Vencimiento',
  companyId: 'Empresa', countryId: 'País', responsibleUserId: 'Responsable', taxId: 'Identificador fiscal',
  email: 'Email', phone: 'Teléfono', isActive: 'Activo', firstName: 'Nombre', lastName: 'Apellido', role: 'Rol',
  code: 'Código', isRead: 'Leída', passwordChanged: 'Contraseña cambiada', originalFilename: 'Archivo',
  mimeType: 'Tipo de archivo', size: 'Tamaño', taxObligationId: 'Obligación', title: 'Título', count: 'Cantidad',
  knownUser: 'Usuario existente',
  trigger: 'Origen', automationRunId: 'Ejecución', overdueMarked: 'Marcada como vencida', notificationsCreated: 'Alertas enviadas',
  errorCode: 'Código de error',
};

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  DEADLINE: 'event_upcoming',
  DOCUMENT: 'description',
  SYSTEM: 'sync_alt',
  AUTOMATION: 'autorenew',
};

export const AUTOMATION_RUN_STATUS: Record<AutomationRunStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'En cola', tone: 'neutral' },
  RUNNING: { label: 'En ejecución', tone: 'info' },
  SUCCEEDED: { label: 'Completada', tone: 'success' },
  FAILED: { label: 'Fallida', tone: 'danger' },
};

export const AUTOMATION_TRIGGER_LABELS: Record<AutomationRunTrigger, string> = {
  MANUAL: 'Manual',
  SCHEDULED: 'Programada',
};

export const AUTOMATION_ERROR_LABELS: Record<AutomationErrorCode, string> = {
  OBLIGATION_NOT_FOUND: 'La obligación ya no existe.',
  NOT_PROCESSABLE: 'La obligación ya no está pendiente, en curso ni vencida.',
  INTERRUPTED: 'El servidor se reinició antes de terminar. No se aplicó ningún cambio.',
  INTERNAL_ERROR: 'Ocurrió un error interno durante el procesamiento.',
};

export function statusLabel(status: TaxObligationStatus): string { return OBLIGATION_STATUS[status]?.label ?? status; }
export function typeLabel(type: TaxObligationType): string { return OBLIGATION_TYPE_LABELS[type] ?? type; }
export function roleLabel(role: UserRole): string { return ROLE_LABELS[role] ?? role; }
export function fieldLabel(field: string): string { return FIELD_LABELS[field] ?? field; }
export function entityLabel(entity: string): string { return AUDIT_ENTITY_LABELS[entity] ?? entity; }
