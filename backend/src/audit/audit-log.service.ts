import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth-user';
import { AuditActorType, AuditAction } from './audit-action.enum';
import { AuditLog } from './audit-log.entity';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { PaginatedResult, paginationMeta } from '../common/pagination-query.dto';

export interface AuditEvent {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  actor?: AuthUser | null;
  actorType?: AuditActorType;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogView {
  id: string;
  actorType: AuditActorType;
  actorEmail: string | null;
  actor: { id: string; firstName: string; lastName: string; email: string } | null;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

const BUSINESS_ENTITIES = ['Company', 'TaxObligation', 'Document', 'Notification', 'AutomationRun'];

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async record(event: AuditEvent, manager?: EntityManager): Promise<AuditLog> {
    const repository = manager?.getRepository(AuditLog) ?? this.auditLogs;
    const actorType = event.actorType ?? 'USER';
    const actor = actorType === 'USER' ? event.actor ?? null : null;
    const safeMetadata = sanitize(event.metadata ?? null) as Record<string, unknown> | null;
    const row = repository.create({
      userId: actor?.id ?? null,
      actorType,
      actorEmail: actor?.email ?? null,
      action: event.action,
      entity: event.entity,
      entityId: event.entityId ?? null,
      metadata: safeMetadata,
    });
    return repository.save(row);
  }

  async findAll(query: AuditLogQueryDto, fullAccess: boolean): Promise<PaginatedResult<AuditLogView>> {
    const builder = this.auditLogs.createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'actor');
    if (!fullAccess) builder.andWhere('audit.entity IN (:...businessEntities)', { businessEntities: BUSINESS_ENTITIES });
    if (query.action) builder.andWhere('audit.action = :action', { action: query.action });
    if (query.entityType) builder.andWhere('audit.entity = :entityType', { entityType: query.entityType });
    if (query.entityId) builder.andWhere('audit.entityId = :entityId', { entityId: query.entityId });
    if (query.actor) builder.andWhere('audit.userId = :actor', { actor: query.actor });
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) throw new BadRequestException('dateFrom must be on or before dateTo.');
    if (query.dateFrom) builder.andWhere('audit.createdAt >= :dateFrom', { dateFrom: startOfLocalDay(query.dateFrom) });
    if (query.dateTo) builder.andWhere('audit.createdAt < :dateToExclusive', { dateToExclusive: startOfLocalDay(query.dateTo, 1) });
    const [rows, total] = await builder.orderBy('audit.createdAt', 'DESC').addOrderBy('audit.id', 'DESC')
      .skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return { data: rows.map(toView), meta: paginationMeta(query.page, query.limit, total) };
  }
}

const SENSITIVE_KEY = /(password|passwordhash|token|secret|credential|authorization|binary|bytes|content|filepath|file_path|refresh)/i;

function sanitize(value: unknown, key = ''): unknown {
  if (key.toLowerCase() === 'passwordchanged') return value === true;
  if (SENSITIVE_KEY.test(key)) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return undefined;
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry)).filter((entry) => entry !== undefined);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([entryKey, entryValue]) => [entryKey, sanitize(entryValue, entryKey)])
      .filter(([, entryValue]) => entryValue !== undefined));
  }
  return undefined;
}

/** Midnight of a YYYY-MM-DD calendar day (plus `offsetDays`) in the backend process timezone, the same reference used for due dates. */
export function startOfLocalDay(value: string, offsetDays = 0): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day + offsetDays);
}

function toView(row: AuditLog): AuditLogView {
  const actor = row.user;
  return {
    id: row.id,
    actorType: row.actorType,
    actorEmail: row.actorEmail ?? actor?.email ?? null,
    actor: actor ? { id: actor.id, firstName: actor.firstName, lastName: actor.lastName, email: actor.email } : null,
    action: row.action as AuditAction,
    entity: row.entity,
    entityId: row.entityId,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}
