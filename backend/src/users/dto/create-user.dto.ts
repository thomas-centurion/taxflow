import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { UserRole } from '../user-role.enum';

export class CreateUserDto {
  @ApiProperty({ minLength: 1, maxLength: 80, example: 'Taylor' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @ApiProperty({ minLength: 1, maxLength: 80, example: 'Manager' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @ApiProperty({ format: 'email', maxLength: 254, example: 'taylor@example.com' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value) @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({ format: 'password', minLength: 8, maxLength: 72, description: 'At most 72 UTF-8 bytes (bcrypt limit).' })
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  @IsEnum(UserRole) role!: UserRole;
  @ApiPropertyOptional({ default: true })
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() isActive?: boolean;
}
