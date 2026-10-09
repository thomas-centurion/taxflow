import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { EntityManager } from 'typeorm';
import { rethrowDatabaseError } from '../common/database-errors';
import { PaginatedResult, PaginationQueryDto, paginationMeta } from '../common/pagination-query.dto';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../audit/audit-action.enum';
import { AuthUser } from '../auth/auth-user';
import { diffFields, pickFields } from '../audit/audit-changes';

const USER_FIELDS = ['firstName', 'lastName', 'email', 'role', 'isActive'] as const;

export interface UserOption { id: string; firstName: string; lastName: string; email: string }

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>, private readonly dataSource: DataSource, private readonly audit: AuditLogService) {}

  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<User>> {
    const builder = this.users.createQueryBuilder('user');
    if (query.search) builder.andWhere('(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)', { search: `%${query.search}%` });
    const [data, total] = await builder.orderBy('user.createdAt', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return { data, meta: paginationMeta(query.page, query.limit, total) };
  }

  async findOptions(): Promise<UserOption[]> {
    const users = await this.users.find({ where: { isActive: true }, order: { firstName: 'ASC', lastName: 'ASC' } });
    return users.map(({ id, firstName, lastName, email }) => ({ id, firstName, lastName, email }));
  }

  async findOne(id: string): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async create(input: CreateUserDto, actor: AuthUser): Promise<User> {
    if (Buffer.byteLength(input.password, 'utf8') > 72) throw new BadRequestException('Password must not exceed 72 UTF-8 bytes.');
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(User);
        const saved = await repository.save(repository.create({ ...input, email: input.email.trim().toLowerCase(), passwordHash }));
        await this.audit.record({ actor, action: AuditAction.CREATE, entity: 'User', entityId: saved.id, metadata: { values: pickFields(saved, USER_FIELDS) } }, manager);
        return (await repository.findOneBy({ id: saved.id }))!;
      });
    } catch (error) { return rethrowDatabaseError(error, 'A user with this email already exists.'); }
  }

  async update(id: string, input: UpdateUserDto, actor: AuthUser): Promise<User> {
    const normalizedInput = { ...input, ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}) };
    if (input.password !== undefined && Buffer.byteLength(input.password, 'utf8') > 72) throw new BadRequestException('Password must not exceed 72 UTF-8 bytes.');
    const passwordHash = input.password === undefined ? undefined : await bcrypt.hash(input.password, 12);
    try { return await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const existing = await repository.createQueryBuilder('user').addSelect('user.passwordHash').where('user.id = :id', { id }).getOne();
      if (!existing) throw new NotFoundException('User not found.');
      const changes = diffFields(existing, normalizedInput, USER_FIELDS);
      const passwordChanged = input.password !== undefined && !(await bcrypt.compare(input.password, existing.passwordHash));
      if (!Object.keys(changes).length && !passwordChanged) return (await repository.findOneBy({ id }))!;
      await this.assertActiveAdminRemains(manager, existing, { role: normalizedInput.role ?? existing.role, isActive: normalizedInput.isActive ?? existing.isActive });
      await repository.save({ ...existing, ...normalizedInput, ...(passwordChanged ? { passwordHash } : {}) });
      await this.audit.record({ actor, action: AuditAction.UPDATE, entity: 'User', entityId: id, metadata: { changes, ...(passwordChanged ? { passwordChanged: true } : {}) } }, manager);
      return (await repository.findOneBy({ id }))!;
    }); }
    catch (error) { return rethrowDatabaseError(error, 'A user with this email already exists.'); }
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    if (id === actor.id) throw new ConflictException('You cannot delete your own account.');
    try { await this.dataSource.transaction(async (manager: EntityManager) => {
      const repository = manager.getRepository(User);
      const existing = await repository.findOneBy({ id });
      if (!existing) throw new NotFoundException('User not found.');
      await this.assertActiveAdminRemains(manager, existing, null);
      const values = pickFields(existing, USER_FIELDS);
      await repository.remove(existing);
      await this.audit.record({ actor, action: AuditAction.DELETE, entity: 'User', entityId: id, metadata: { values } }, manager);
    }); }
    catch (error) { return rethrowDatabaseError(error, 'User cannot be deleted because it has associated records.'); }
  }

  private async assertActiveAdminRemains(manager: EntityManager, target: User, next: { role: UserRole; isActive: boolean } | null): Promise<void> {
    const wasActiveAdmin = target.role === UserRole.ADMIN && target.isActive;
    const staysActiveAdmin = next !== null && next.role === UserRole.ADMIN && next.isActive;
    if (!wasActiveAdmin || staysActiveAdmin) return;
    const activeAdmins = await manager.getRepository(User).createQueryBuilder('user')
      .setLock('pessimistic_write')
      .where('user.role = :role AND user.isActive = :isActive', { role: UserRole.ADMIN, isActive: true })
      .getMany();
    // siempre tiene que quedar al menos un admin activo
    if (!activeAdmins.some((admin) => admin.id !== target.id)) throw new ConflictException('The system must keep at least one active ADMIN.');
  }
}
