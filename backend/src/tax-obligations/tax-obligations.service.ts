import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Company } from '../companies/company.entity';
import { rethrowDatabaseError } from '../common/database-errors';
import { PaginatedResult, paginationMeta } from '../common/pagination-query.dto';
import { User } from '../users/user.entity';
import { Document } from '../documents/document.entity';
import { TaxObligation } from './tax-obligation.entity';
import { CreateTaxObligationDto } from './dto/create-tax-obligation.dto';
import { TaxObligationQueryDto } from './dto/tax-obligation-query.dto';
import { UpdateTaxObligationDto } from './dto/update-tax-obligation.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../audit/audit-action.enum';
import { AuthUser } from '../auth/auth-user';
import { diffFields, pickFields } from '../audit/audit-changes';

const OBLIGATION_FIELDS = ['companyId', 'countryId', 'name', 'description', 'type', 'status', 'dueDate', 'responsibleUserId'] as const;

@Injectable()
export class TaxObligationsService {
  constructor(
    @InjectRepository(TaxObligation) private readonly obligations: Repository<TaxObligation>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Document) private readonly documents: Repository<Document>,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: TaxObligationQueryDto): Promise<PaginatedResult<TaxObligation>> {
    const builder = this.obligations.createQueryBuilder('obligation')
      .leftJoinAndSelect('obligation.company', 'company')
      .leftJoinAndSelect('company.country', 'companyCountry')
      .leftJoinAndSelect('obligation.country', 'country')
      .leftJoinAndSelect('obligation.responsibleUser', 'responsibleUser');
    if (query.company) builder.andWhere('obligation.companyId = :company', { company: query.company });
    if (query.country) builder.andWhere('obligation.countryId = :country', { country: query.country });
    if (query.status) builder.andWhere('obligation.status = :status', { status: query.status });
    if (query.type) builder.andWhere('obligation.type = :type', { type: query.type });
    if (query.responsibleUser) builder.andWhere('obligation.responsibleUserId = :responsibleUser', { responsibleUser: query.responsibleUser });
    if (query.dueDate) builder.andWhere('obligation.dueDate = :dueDate', { dueDate: query.dueDate });
    if (query.search) builder.andWhere('(obligation.name ILIKE :search OR company.name ILIKE :search)', { search: `%${query.search}%` });
    const [data, total] = await builder.orderBy('obligation.dueDate', 'ASC').addOrderBy('obligation.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return { data, meta: paginationMeta(query.page, query.limit, total) };
  }

  async findOne(id: string): Promise<TaxObligation> {
    const obligation = await this.obligations.findOne({ where: { id }, relations: { company: { country: true }, country: true, responsibleUser: true } });
    if (!obligation) throw new NotFoundException('Tax obligation not found.');
    return obligation;
  }

  private async validateRelations(companyId: string, countryId: string, responsibleUserId?: string | null): Promise<void> {
    const company = await this.companies.findOne({ where: { id: companyId }, relations: { country: true } });
    if (!company) throw new NotFoundException('Company not found.');
    if (company.countryId !== countryId) throw new BadRequestException('The selected country does not match the company country.');
    if (responsibleUserId) {
      const user = await this.users.findOneBy({ id: responsibleUserId, isActive: true });
      if (!user) throw new NotFoundException('Active responsible user not found.');
    }
  }

  async create(input: CreateTaxObligationDto, actor: AuthUser): Promise<TaxObligation> {
    await this.validateRelations(input.companyId, input.countryId, input.responsibleUserId);
    try { return await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TaxObligation);
      const created = await repository.save(repository.create(input));
      await this.audit.record({ actor, action: AuditAction.CREATE, entity: 'TaxObligation', entityId: created.id, metadata: { values: pickFields(created, OBLIGATION_FIELDS) } }, manager);
      return (await repository.findOne({ where: { id: created.id }, relations: { company: { country: true }, country: true, responsibleUser: true } }))!;
    }); }
    catch (error) { return rethrowDatabaseError(error, 'An obligation with the same company, name, type and due date already exists.'); }
  }

  async update(id: string, input: UpdateTaxObligationDto, actor: AuthUser): Promise<TaxObligation> {
    const existing = await this.findOne(id);
    const previousStatus = existing.status;
    const companyId = input.companyId ?? existing.companyId;
    const countryId = input.countryId ?? existing.countryId;
    const responsibleUserId = input.responsibleUserId === undefined ? existing.responsibleUserId : input.responsibleUserId;
    await this.validateRelations(companyId, countryId, responsibleUserId);
    try { return await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TaxObligation);
      const current = await repository.findOne({ where: { id }, relations: { company: { country: true }, country: true, responsibleUser: true } });
      if (!current) throw new NotFoundException('Tax obligation not found.');
      const changes = diffFields(current, input, OBLIGATION_FIELDS);
      if (!Object.keys(changes).length) return current;
      const saved = await repository.save({ ...current, ...input, responsibleUserId });
      await this.audit.record({ actor, action: AuditAction.UPDATE, entity: 'TaxObligation', entityId: id, metadata: { changes } }, manager);
      if (changes.status) await this.notifications.notifyStatusChanged({ ...saved, responsibleUserId }, String(changes.status.before), manager);
      return (await repository.findOne({ where: { id }, relations: { company: { country: true }, country: true, responsibleUser: true } })) ?? saved;
    }); }
    catch (error) { return rethrowDatabaseError(error, 'An obligation with the same company, name, type and due date already exists.'); }
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    try { await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TaxObligation);
      const obligation = await repository.findOne({ where: { id }, relations: { company: true, country: true, responsibleUser: true } });
      if (!obligation) throw new NotFoundException('Tax obligation not found.');
      if (await manager.getRepository(Document).countBy({ taxObligationId: id })) throw new ConflictException('Delete associated documents before deleting this tax obligation.');
      const values = pickFields(obligation, OBLIGATION_FIELDS);
      await repository.remove(obligation);
      await this.audit.record({ actor, action: AuditAction.DELETE, entity: 'TaxObligation', entityId: id, metadata: { values } }, manager);
    }); }
    catch (error) { return rethrowDatabaseError(error, 'Tax obligation cannot be deleted while documents reference it.'); }
  }
}
