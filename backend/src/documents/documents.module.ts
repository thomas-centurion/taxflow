import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { User } from '../users/user.entity';
import { Document } from './document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalStorageService } from './local-storage.service';
import { StorageService } from './storage.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Document, TaxObligation, User]), NotificationsModule, AuditModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, LocalStorageService, { provide: StorageService, useExisting: LocalStorageService }],
  exports: [DocumentsService],
})
export class DocumentsModule {}
