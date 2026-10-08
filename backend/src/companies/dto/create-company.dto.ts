import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ minLength: 1, maxLength: 200, example: 'ACME Argentina S.A.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @ApiProperty({ minLength: 1, maxLength: 100, example: '30-71234567-9', description: 'Unique per country.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(100) taxId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID() countryId!: string;
  @ApiPropertyOptional({ format: 'email', maxLength: 254, nullable: true })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value) @IsEmail() @MaxLength(254) email?: string | null;
  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(40) phone?: string | null;
  @ApiPropertyOptional({ default: true })
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() isActive?: boolean;
}
