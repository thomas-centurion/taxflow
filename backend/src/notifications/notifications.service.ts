import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth-user';
import { PaginatedResult, paginationMeta } from '../common/pagination-query.dto';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { Notification } from './notification.entity';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationType } from './notification-type.enum';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../audit/audit-action.enum';

export interface NotificationView {
  id: string; title: string; message: string; type: NotificationType; isRead: boolean; createdAt: Date;
  taxObligation: { id: string; name: string } | null;
}

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private readonly notifications: Repository<Notification>, private readonly dataSource: DataSource, private readonly audit: AuditLogService) {}

  async findAll(user: AuthUser, query: NotificationQueryDto): Promise<PaginatedResult<NotificationView>> {
    const builder = this.notifications.createQueryBuilder('notification')
      .leftJoinAndSelect('notification.taxObligation', 'obligation')
      .where('notification.userId = :userId', { userId: user.id });
    if (query.unread !== undefined) builder.andWhere('notification.isRead = :isRead', { isRead: !query.unread });
    const [rows, total] = await builder.orderBy('notification.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return { data: rows.map(toView), meta: paginationMeta(query.page, query.limit, total) };
  }

  unreadCount(user: AuthUser): Promise<number> {
    return this.notifications.countBy({ userId: user.id, isRead: false });
  }

  async markRead(user: AuthUser, id: string): Promise<NotificationView> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Notification);
      const notification = await repository.findOne({ where: { id, userId: user.id }, relations: { taxObligation: true } });
      if (!notification) throw new NotFoundException('Notification not found.');
      if (!notification.isRead) {
        const result = await repository.update({ id, userId: user.id, isRead: false }, { isRead: true });
        if (result.affected) {
          await this.audit.record({ actor: user, action: AuditAction.MARK_READ, entity: 'Notification', entityId: id, metadata: { changes: { isRead: { before: false, after: true } } } }, manager);
          notification.isRead = true;
        } else {
          notification.isRead = true;
        }
      }
      return toView(notification);
    });
  }

  async markAllRead(user: AuthUser): Promise<{ updated: number }> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(Notification).update({ userId: user.id, isRead: false }, { isRead: true });
      const updated = result.affected ?? 0;
      if (updated) await this.audit.record({ actor: user, action: AuditAction.MARK_READ, entity: 'Notification', metadata: { count: updated, changes: { isRead: { before: false, after: true } } } }, manager);
      return { updated };
    });
  }

  async createOnce(input: {
    userId: string; title: string; message: string; type: NotificationType;
    taxObligationId: string; dedupeKey: string;
  }, manager?: EntityManager): Promise<boolean> {
    if (manager) return this.insertOnce(input, manager);
    return this.dataSource.transaction((transaction) => this.insertOnce(input, transaction));
  }

  async notifyStatusChanged(obligation: Pick<TaxObligation, 'id' | 'name' | 'status' | 'responsibleUserId' | 'updatedAt'>, previousStatus: string, manager?: EntityManager): Promise<void> {
    if (!obligation.responsibleUserId) return;
    await this.createOnce({
      userId: obligation.responsibleUserId,
      title: 'Cambio de estado',
      message: `${obligation.name}: el estado cambió de ${previousStatus} a ${obligation.status}.`,
      type: NotificationType.SYSTEM,
      taxObligationId: obligation.id,
      dedupeKey: `status:${obligation.id}:${obligation.updatedAt.toISOString()}`,
    }, manager);
  }

  async notifyDocumentUploaded(obligation: TaxObligation, documentId: string, fileName: string, manager?: EntityManager): Promise<void> {
    if (!obligation.responsibleUserId) return;
    await this.createOnce({
      userId: obligation.responsibleUserId,
      title: 'Documento agregado',
      message: `Se agregó ${fileName} a ${obligation.name}.`,
      type: NotificationType.DOCUMENT,
      taxObligationId: obligation.id,
      dedupeKey: `document:${documentId}`,
    }, manager);
  }

  /** Tells each recipient (deduplicated) how an automation run ended. One notification per run and user. */
  async notifyAutomationResult(input: { runId: string; taxObligationId: string; userIds: (string | null | undefined)[]; title: string; message: string }): Promise<void> {
    const recipients = [...new Set(input.userIds.filter((id): id is string => !!id))];
    for (const userId of recipients) {
      await this.createOnce({
        userId,
        title: input.title,
        message: input.message,
        type: NotificationType.AUTOMATION,
        taxObligationId: input.taxObligationId,
        dedupeKey: `automation:${input.runId}:${userId}`,
      });
    }
  }

  async notifyDeadline(obligation: TaxObligation, daysUntilDue: number, manager?: EntityManager): Promise<number> {
    if (!obligation.responsibleUserId) return 0;
    const companyName = obligation.company?.name ?? 'la empresa';
    if (daysUntilDue < 0) {
      const created = await this.createOnce({
        userId: obligation.responsibleUserId,
        title: 'Obligación vencida',
        message: `${obligation.name} de ${companyName} venció el ${obligation.dueDate}.`,
        type: NotificationType.DEADLINE,
        taxObligationId: obligation.id,
        dedupeKey: `deadline:overdue:${obligation.id}:${obligation.dueDate}`,
      }, manager);
      return created ? 1 : 0;
    }

    let created = 0;
    for (const threshold of [7, 3, 1]) {
      if (daysUntilDue > threshold) continue;
      const urgent = threshold <= 3;
      const title = urgent ? `Vencimiento urgente — ${threshold} día${threshold === 1 ? '' : 's'}` : 'Próximo vencimiento — 7 días';
      const message = `${obligation.name} de ${companyName} vence en ${daysUntilDue} día${daysUntilDue === 1 ? '' : 's'} (${obligation.dueDate}).`;
      if (await this.createOnce({
        userId: obligation.responsibleUserId,
        title,
        message,
        type: NotificationType.DEADLINE,
        taxObligationId: obligation.id,
        dedupeKey: `deadline:${threshold}:${obligation.id}:${obligation.dueDate}`,
      }, manager)) created += 1;
    }
    return created;
  }

  private async insertOnce(input: { userId: string; title: string; message: string; type: NotificationType; taxObligationId: string; dedupeKey: string }, manager: EntityManager): Promise<boolean> {
    const repository = manager.getRepository(Notification);
    const result = await repository.createQueryBuilder().insert().into(Notification).values({ ...input, isRead: false }).orIgnore().execute();
    const id = result.identifiers[0]?.id as string | undefined;
    if (!id) return false;
    await this.audit.record({ actorType: 'SYSTEM', action: AuditAction.NOTIFICATION_CREATED, entity: 'Notification', entityId: id, metadata: { type: input.type, title: input.title, taxObligationId: input.taxObligationId } }, manager);
    return true;
  }
}

function toView(notification: Notification): NotificationView {
  return {
    id: notification.id, title: notification.title, message: notification.message,
    type: notification.type, isRead: notification.isRead, createdAt: notification.createdAt,
    taxObligation: notification.taxObligation ? { id: notification.taxObligation.id, name: notification.taxObligation.name } : null,
  };
}
