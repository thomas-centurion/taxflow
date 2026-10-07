import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Country } from '../countries/country.entity';
import { rethrowDatabaseError } from '../common/database-errors';
import { PaginatedResult, PaginationQueryDto, paginationMeta } from '../common/pagination-query.dto';
import { Company } from './company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../audit/audit-action.enum';
import { AuthUser } from '../auth/auth-user';
import { diffFields, pickFields } from '../audit/audit-changes';

const COMPANY_FIELDS = ['name', 'taxId', 'countryId', 'email', 'phone', 'isActive'] as const;

@Injectable()
export class CompaniesService {
  constructor(@InjectRepository(Company) private readonly companies: Repository<Company>, @InjectRepository(Country) private readonly countries: Repository<Country>, private readonly dataSource: DataSource, private readonly audit: AuditLogService) {}

  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<Company>> {
    const builder = this.companies.createQueryBuilder('company').leftJoinAndSelect('company.country', 'country');
    if (query.search) builder.andWhere('(company.name ILIKE :search OR company.taxId ILIKE :search OR company.email ILIKE :search)', { search: `%${query.search}%` });
    const [data, total] = await builder.orderBy('company.createdAt', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return { data, meta: paginationMeta(query.page, query.limit, total) };
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companies.findOne({ where: { id }, relations: { country: true } });
    if (!company) throw new NotFoundException('Company not found.');
    return company;
  }

  private async ensureCountry(countryId: string): Promise<void> {
    if (!await this.countries.existsBy({ id: countryId })) throw new NotFoundException('Country not found.');
  }

  async create(input: CreateCompanyDto, actor: AuthUser): Promise<Company> {
    await this.ensureCountry(input.countryId);
    try { return await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Company);
      const created = await repository.save(repository.create(input));
      await this.audit.record({ actor, action: AuditAction.CREATE, entity: 'Company', entityId: created.id, metadata: { values: pickFields(created, COMPANY_FIELDS) } }, manager);
      return (await repository.findOne({ where: { id: created.id }, relations: { country: true } }))!;
    }); }
    catch (error) { return rethrowDatabaseError(error, 'A company with this tax ID already exists in the selected country.'); }
  }

  async update(id: string, input: UpdateCompanyDto, actor: AuthUser): Promise<Company> {
    if (input.countryId) await this.ensureCountry(input.countryId);
    try { return await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Company);
      const existing = await repository.findOne({ where: { id }, relations: { country: true } });
      if (!existing) throw new NotFoundException('Company not found.');
      const changes = diffFields(existing, input, COMPANY_FIELDS);
      if (!Object.keys(changes).length) return existing;
      const updated = await repository.save({ ...existing, ...input });
      await this.audit.record({ actor, action: AuditAction.UPDATE, entity: 'Company', entityId: id, metadata: { changes } }, manager);
      return (await repository.findOne({ where: { id }, relations: { country: true } })) ?? updated;
    }); }
    catch (error) { return rethrowDatabaseError(error, 'A company with this tax ID already exists in the selected country.'); }
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    try { await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Company);
      const company = await repository.findOne({ where: { id }, relations: { country: true } });
      if (!company) throw new NotFoundException('Company not found.');
      const values = pickFields(company, COMPANY_FIELDS);
      await repository.remove(company);
      await this.audit.record({ actor, action: AuditAction.DELETE, entity: 'Company', entityId: id, metadata: { values } }, manager);
    }); }
    catch (error) { return rethrowDatabaseError(error, 'Company cannot be deleted while obligations or documents reference it.'); }
  }
}
