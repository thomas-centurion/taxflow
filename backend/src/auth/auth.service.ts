import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AuthUser } from './auth-user';
import { LoginDto } from './login.dto';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../audit/audit-action.enum';

@Injectable()
export class AuthService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>, private readonly jwt: JwtService, private readonly audit: AuditLogService) {}

  async login(credentials: LoginDto): Promise<{ accessToken: string; tokenType: 'Bearer'; user: AuthUser }> {
    if (Buffer.byteLength(credentials.password, 'utf8') > 72) throw new UnauthorizedException('Invalid credentials');
    const user = await this.users.createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: credentials.email })
      .getOne();
    if (!user || !user.isActive || !(await bcrypt.compare(credentials.password, user.passwordHash))) {
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
    return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, isActive: user.isActive };
  }
}
