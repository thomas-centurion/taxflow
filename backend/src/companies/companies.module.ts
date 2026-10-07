import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Country } from '../countries/country.entity';
import { Company } from './company.entity';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { AuditModule } from '../audit/audit.module';

@Module({ imports: [TypeOrmModule.forFeature([Company, Country]), AuditModule], controllers: [CompaniesController], providers: [CompaniesService] })
export class CompaniesModule {}
