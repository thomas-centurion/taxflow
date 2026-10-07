import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../companies/company.entity';
import { User } from '../users/user.entity';
import { Document } from '../documents/document.entity';
import { TaxObligation } from './tax-obligation.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { TaxObligationsController } from './tax-obligations.controller';
import { TaxObligationsService } from './tax-obligations.service';
import { AuditModule } from '../audit/audit.module';

@Module({ imports: [TypeOrmModule.forFeature([TaxObligation, Company, User, Document]), NotificationsModule, AuditModule], controllers: [TaxObligationsController], providers: [TaxObligationsService] })
export class TaxObligationsModule {}
