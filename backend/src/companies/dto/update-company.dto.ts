import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

const whenProvided = (_object: unknown, value: unknown) => value !== undefined;

export class UpdateCompanyDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 200 })
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(100) taxId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Cannot change while the company has tax obligations.' })
  @ValidateIf(whenProvided) @IsUUID() countryId?: string;
  @ApiPropertyOptional({ format: 'email', maxLength: 254, nullable: true })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value) @IsEmail() @MaxLength(254) email?: string | null;
  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(40) phone?: string | null;
  @ApiPropertyOptional()
  @ValidateIf(whenProvided) @IsBoolean() isActive?: boolean;
}
