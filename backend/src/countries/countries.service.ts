import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { rethrowDatabaseError } from '../common/database-errors';
import { PaginatedResult, PaginationQueryDto, paginationMeta } from '../common/pagination-query.dto';
import { Country } from './country.entity';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../audit/audit-action.enum';
import { AuthUser } from '../auth/auth-user';
import { diffFields, pickFields } from '../audit/audit-changes';

const COUNTRY_FIELDS = ['name', 'code'] as const;

@Injectable()
export class CountriesService {
  constructor(@InjectRepository(Country) private readonly countries: Repository<Country>, private readonly dataSource: DataSource, private readonly audit: AuditLogService) {}
  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<Country>> {
    const builder = this.countries.createQueryBuilder('country');
    if (query.search) builder.andWhere('(country.name ILIKE :search OR country.code ILIKE :search)', { search: `%${query.search}%` });
    const [data, total] = await builder.orderBy('country.name', 'ASC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return { data, meta: paginationMeta(query.page, query.limit, total) };
  }
  async findOne(id: string): Promise<Country> {
    const country = await this.countries.findOneBy({ id });
    if (!country) throw new NotFoundException('Country not found.');
    return country;
  }
  async create(input: CreateCountryDto, actor: AuthUser): Promise<Country> {
    try { return await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Country);
      const created = await repository.save(repository.create(input));
      await this.audit.record({ actor, action: AuditAction.CREATE, entity: 'Country', entityId: created.id, metadata: { values: pickFields(created, COUNTRY_FIELDS) } }, manager);
      return created;
    }); }
    catch (error) { return rethrowDatabaseError(error, 'A country with this code already exists.'); }
  }
  async update(id: string, input: UpdateCountryDto, actor: AuthUser): Promise<Country> {
    try { return await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Country);
      const existing = await repository.findOneBy({ id });
      if (!existing) throw new NotFoundException('Country not found.');
      const changes = diffFields(existing, input, COUNTRY_FIELDS);
      if (!Object.keys(changes).length) return existing;
      const updated = await repository.save({ ...existing, ...input });
      await this.audit.record({ actor, action: AuditAction.UPDATE, entity: 'Country', entityId: id, metadata: { changes } }, manager);
      return updated;
    }); }
    catch (error) { return rethrowDatabaseError(error, 'A country with this code already exists.'); }
  }
  async remove(id: string, actor: AuthUser): Promise<void> {
    try { await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Country);
      const country = await repository.findOneBy({ id });
      if (!country) throw new NotFoundException('Country not found.');
      const values = pickFields(country, COUNTRY_FIELDS);
      await repository.remove(country);
      await this.audit.record({ actor, action: AuditAction.DELETE, entity: 'Country', entityId: id, metadata: { values } }, manager);
    }); }
    catch (error) { return rethrowDatabaseError(error, 'Country cannot be deleted while companies or obligations reference it.'); }
  }
}
