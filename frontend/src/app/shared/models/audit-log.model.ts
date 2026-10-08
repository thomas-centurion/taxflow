export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'UPLOAD' | 'DOWNLOAD' | 'MARK_READ' | 'NOTIFICATION_CREATED' | 'LOGIN_FAILED'
  | 'AUTOMATION_STARTED' | 'AUTOMATION_SUCCEEDED' | 'AUTOMATION_FAILED';
export type AuditActorType = 'USER' | 'SYSTEM';

export interface AuditLog {
  id: string;
  actorType: AuditActorType;
  actorEmail: string | null;
  actor: { id: string; firstName: string; lastName: string; email: string } | null;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogPage {
  data: AuditLog[];
  meta: { page: number; limit: number; total: number; pageCount: number };
}

export interface AuditLogFilters {
  page: number;
  limit: number;
  action?: AuditAction;
  entityType?: string;
  actor?: string;
  dateFrom?: string;
  dateTo?: string;
}
