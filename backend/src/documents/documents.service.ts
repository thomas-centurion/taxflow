import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth-user';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { User } from '../users/user.entity';
import { Document } from './document.entity';
import { IncomingDocumentFile, validateDocumentFile } from './file-validation';
import { StorageObjectNotFoundError, StorageService } from './storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../audit/audit-action.enum';

export interface DocumentResponse {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  taxObligationId: string;
  uploadedBy: { id: string; firstName: string; lastName: string };
  createdAt: Date;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private readonly documents: Repository<Document>,
    @InjectRepository(TaxObligation) private readonly obligations: Repository<TaxObligation>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditLogService,
  ) {}

  async listForObligation(obligationId: string): Promise<DocumentResponse[]> {
    await this.requireObligation(obligationId);
    const records = await this.documents.find({ where: { taxObligationId: obligationId }, relations: { uploadedBy: true }, order: { createdAt: 'DESC' } });
    return records.map(toResponse);
  }

  async upload(obligationId: string, uploader: AuthUser, incoming: IncomingDocumentFile | undefined): Promise<DocumentResponse> {
    const obligation = await this.requireObligation(obligationId);
    const file = validateDocumentFile(incoming);
    const storageKey = `documents/${randomUUID()}${file.extension}`;
    await this.storage.save(storageKey, file.content);
    let record: Document;
    try {
      record = await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(Document);
        const saved = await repository.save(repository.create({
          companyId: obligation.companyId,
          taxObligationId: obligation.id,
          fileName: file.originalFilename,
          filePath: storageKey,
          mimeType: file.mimeType,
          fileSize: file.size,
          uploadedById: uploader.id,
        }));
        await this.audit.record({ actor: uploader, action: AuditAction.UPLOAD, entity: 'Document', entityId: saved.id, metadata: { originalFilename: file.originalFilename, mimeType: file.mimeType, size: file.size, companyId: obligation.companyId, taxObligationId: obligation.id } }, manager);
        await this.notifications.notifyDocumentUploaded(obligation, saved.id, file.originalFilename, manager);
        return saved;
      });
    } catch (error) {
      try { await this.storage.delete(storageKey); }
      catch { throw new InternalServerErrorException('Document metadata could not be saved and storage cleanup failed.'); }
      const driverCode = (error as { driverError?: { code?: string } }).driverError?.code;
      if (driverCode === '23503') throw new ConflictException('Document references a record that no longer exists.');
      throw new InternalServerErrorException('Document metadata could not be saved.');
    }
    return toResponse({ ...record, uploadedBy: uploader as User });
  }

  async download(id: string, actor: AuthUser): Promise<{ content: Buffer; mimeType: string; originalFilename: string }> {
    const record = await this.findDocument(id);
    try {
      const content = await this.storage.get(record.filePath);
      await this.audit.record({ actor, action: AuditAction.DOWNLOAD, entity: 'Document', entityId: id, metadata: { originalFilename: record.fileName, mimeType: record.mimeType, size: record.fileSize, companyId: record.companyId, taxObligationId: record.taxObligationId } });
      return { content, mimeType: record.mimeType, originalFilename: record.fileName };
    }
    catch (error) { if (error instanceof StorageObjectNotFoundError) throw new NotFoundException('Document file not found.'); throw error; }
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const record = await this.findDocument(id);
    let backup: Buffer | undefined;
    try { if (await this.storage.exists(record.filePath)) backup = await this.storage.get(record.filePath); }
    catch (error) { if (!(error instanceof StorageObjectNotFoundError)) throw error; }

    await this.storage.delete(record.filePath);
    try { await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Document).remove(record);
      await this.audit.record({ actor, action: AuditAction.DELETE, entity: 'Document', entityId: id, metadata: { originalFilename: record.fileName, mimeType: record.mimeType, size: record.fileSize, companyId: record.companyId, taxObligationId: record.taxObligationId } }, manager);
    }); }
    catch (error) {
      if (backup) {
        try { await this.storage.save(record.filePath, backup); }
        catch { throw new InternalServerErrorException('Document metadata could not be removed and storage rollback failed.'); }
      }
      const driverCode = (error as { driverError?: { code?: string } }).driverError?.code;
      if (driverCode === '23503') throw new ConflictException('Document is still referenced and cannot be deleted.');
      throw new InternalServerErrorException('Document metadata could not be removed.');
    }
  }

  private async requireObligation(id: string): Promise<TaxObligation> {
    const obligation = await this.obligations.findOne({ where: { id }, relations: { company: true } });
    if (!obligation) throw new NotFoundException('Tax obligation not found.');
    return obligation;
  }

  private async findDocument(id: string): Promise<Document> {
    const document = await this.documents.findOne({ where: { id }, relations: { uploadedBy: true } });
    if (!document) throw new NotFoundException('Document not found.');
    return document;
  }
}

function toResponse(record: Document): DocumentResponse {
  return {
    id: record.id,
    originalFilename: record.fileName,
    mimeType: record.mimeType,
    size: record.fileSize,
    taxObligationId: record.taxObligationId,
    uploadedBy: { id: record.uploadedBy.id, firstName: record.uploadedBy.firstName, lastName: record.uploadedBy.lastName },
    createdAt: record.createdAt,
  };
}
