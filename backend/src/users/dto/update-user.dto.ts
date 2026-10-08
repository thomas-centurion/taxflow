import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { UserRole } from '../user-role.enum';

const whenProvided = (_object: unknown, value: unknown) => value !== undefined;

export class UpdateUserDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(80) firstName?: string;
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(80) lastName?: string;
  @ApiPropertyOptional({ format: 'email', maxLength: 254 })
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value) @IsEmail() @MaxLength(254) email?: string;
  @ApiPropertyOptional({ format: 'password', minLength: 8, maxLength: 72 })
  @ValidateIf(whenProvided) @IsString() @MinLength(8) @MaxLength(72) password?: string;
  @ApiPropertyOptional({ enum: UserRole, enumName: 'UserRole', description: 'Changes that would leave no active ADMIN are rejected.' })
  @ValidateIf(whenProvided) @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional()
  @ValidateIf(whenProvided) @IsBoolean() isActive?: boolean;
}
