import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Country } from './country.entity';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';
import { AuditModule } from '../audit/audit.module';

@Module({ imports: [TypeOrmModule.forFeature([Country]), AuditModule], controllers: [CountriesController], providers: [CountriesService] })
export class CountriesModule {}
