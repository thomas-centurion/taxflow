import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../users/user-role.enum';
import { AuthUser } from './auth-user';

export class AuthUserDto implements AuthUser {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Taylor' }) firstName!: string;
  @ApiProperty({ example: 'Manager' }) lastName!: string;
  @ApiProperty({ example: 'manager@taxflow.local' }) email!: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' }) role!: UserRole;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ description: 'Read-only demo account (DEMO_READ_ONLY_EMAILS): every write answers 403.' }) readOnly!: boolean;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT to send as `Authorization: Bearer <accessToken>`. Expires after JWT_EXPIRES_IN.' }) accessToken!: string;
  @ApiProperty({ enum: ['Bearer'] }) tokenType!: 'Bearer';
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true }) success!: true;
}
