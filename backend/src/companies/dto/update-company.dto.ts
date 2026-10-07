import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

const whenProvided = (_object: unknown, value: unknown) => value !== undefined;

export class UpdateCompanyDto {
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(100) taxId?: string;
  @ValidateIf(whenProvided) @IsUUID() countryId?: string;
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value) @IsEmail() @MaxLength(254) email?: string | null;
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(40) phone?: string | null;
  @ValidateIf(whenProvided) @IsBoolean() isActive?: boolean;
}