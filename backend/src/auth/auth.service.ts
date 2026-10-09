import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AuthUser } from './auth-user';
import { LoginDto } from './login.dto';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../audit/audit-action.enum';
import { ReadOnlyAccounts } from './read-only-accounts';

let equalizerHash: Promise<string> | undefined;
function timingEqualizerHash(): Promise<string> {
  return equalizerHash ??= bcrypt.hash(randomUUID(), 12);
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly audit: AuditLogService,
    private readonly readOnlyAccounts: ReadOnlyAccounts,
  ) {}

  async login(credentials: LoginDto): Promise<{ accessToken: string; tokenType: 'Bearer'; user: AuthUser }> {
    if (Buffer.byteLength(credentials.password, 'utf8') > 72) throw new UnauthorizedException('Invalid credentials');
    const user = await this.users.createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: credentials.email })
      .getOne();
    // bcrypt corre siempre para que el tiempo de respuesta no delate si la cuenta existe
    const passwordMatches = await bcrypt.compare(credentials.password, user?.passwordHash ?? await timingEqualizerHash());
    if (!user || !user.isActive || !passwordMatches) {
      await this.audit.record({ action: AuditAction.LOGIN_FAILED, entity: 'User', entityId: user?.id ?? null, metadata: user ? { email: user.email } : { knownUser: false } });
      throw new UnauthorizedException('Invalid credentials');
    }
    const safeUser = this.toAuthUser(user);
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    await this.audit.record({ actor: safeUser, action: AuditAction.LOGIN, entity: 'User', entityId: user.id, metadata: { role: user.role } });
    return { accessToken, tokenType: 'Bearer', user: safeUser };
  }

  async logout(user: AuthUser): Promise<{ success: true }> {
    await this.audit.record({ actor: user, action: AuditAction.LOGOUT, entity: 'User', entityId: user.id });
    return { success: true };
  }

  toAuthUser(user: User): AuthUser {
    return {
      id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, isActive: user.isActive,
      readOnly: this.readOnlyAccounts.isReadOnly(user.email),
    };
  }
}
