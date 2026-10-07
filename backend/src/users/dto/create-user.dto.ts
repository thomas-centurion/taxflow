import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { UserRole } from '../user-role.enum';

export class CreateUserDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value) @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
  @IsEnum(UserRole) role!: UserRole;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() isActive?: boolean;
}