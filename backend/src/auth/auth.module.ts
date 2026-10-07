import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { AuditModule } from '../audit/audit.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoginThrottlerGuard } from './login-throttler.guard';

function positiveInteger(config: ConfigService, key: string, fallback: number): number {
  const value = Number(config.get<string>(key, String(fallback)));
  if (!Number.isInteger(value) || value < 1) throw new Error(`${key} must be a positive integer.`);
  return value;
}

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AuditModule,
    PassportModule,
    // Only applied to POST /auth/login through LoginThrottlerGuard; there is no global throttling.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: positiveInteger(config, 'LOGIN_THROTTLE_TTL_SECONDS', 60) * 1000, limit: positiveInteger(config, 'LOGIN_THROTTLE_LIMIT', 5) }],
        errorMessage: 'Too many login attempts. Please try again later.',
      }),
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        if (Buffer.byteLength(secret, 'utf8') < 32) throw new Error('JWT_SECRET must contain at least 32 bytes.');
        return { secret, signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1d') as JwtSignOptions['expiresIn'] } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, LoginThrottlerGuard,
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
  ],
})
export class AuthModule {}
