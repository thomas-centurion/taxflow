import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'node:path';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { AutomationModule } from './automation/automation.module';
import { CompaniesModule } from './companies/companies.module';
import { CountriesModule } from './countries/countries.module';
import { DocumentsModule } from './documents/documents.module';
import { createDatabaseOptions } from './database/database-options';
import { entities } from './database/entities';
import { migrations } from './database/migrations';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TaxObligationsModule } from './tax-obligations/tax-obligations.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: resolve(__dirname, '..', '..', '.env') }),
    TypeOrmModule.forRootAsync({ useFactory: () => createDatabaseOptions(process.env, entities, migrations) }),
    AuthModule,
    AuditModule,
    NotificationsModule,
    AutomationModule,
    UsersModule,
    CompaniesModule,
    CountriesModule,
    DocumentsModule,
    TaxObligationsModule,
    HealthModule,
  ],
})
export class AppModule {}
