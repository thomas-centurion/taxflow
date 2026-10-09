import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AuthUser } from './auth-user';
import { JwtPayload } from './jwt-payload';
import { ReadOnlyAccounts } from './read-only-accounts';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, @InjectRepository(User) private readonly users: Repository<User>, private readonly readOnlyAccounts: ReadOnlyAccounts) {
    const secret = config.getOrThrow<string>('JWT_SECRET');
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: secret });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // se recarga el usuario en cada request: desactivarlo invalida sus tokens al instante
    const user = await this.users.findOne({ where: { id: payload.sub, isActive: true } });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, isActive: user.isActive,
      readOnly: this.readOnlyAccounts.isReadOnly(user.email),
    };
  }
}