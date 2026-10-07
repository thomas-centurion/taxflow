import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { UserRole } from '../user-role.enum';

const whenProvided = (_object: unknown, value: unknown) => value !== undefined;

export class UpdateUserDto {
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(80) firstName?: string;
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(80) lastName?: string;
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value) @IsEmail() @MaxLength(254) email?: string;
  @ValidateIf(whenProvided) @IsString() @MinLength(8) @MaxLength(72) password?: string;
  @ValidateIf(whenProvided) @IsEnum(UserRole) role?: UserRole;
  @ValidateIf(whenProvided) @IsBoolean() isActive?: boolean;
}