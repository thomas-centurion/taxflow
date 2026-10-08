import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength, Matches, ValidateIf } from 'class-validator';
import { TaxObligationStatus } from '../tax-obligation-status.enum';
import { TaxObligationType } from '../tax-obligation-type.enum';

export class CreateTaxObligationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID() companyId!: string;
  @ApiProperty({ format: 'uuid', description: 'Must be the company\'s country.' })
  @IsUUID() countryId!: string;
  @ApiProperty({ minLength: 1, maxLength: 200, example: 'IVA mensual — octubre' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() description?: string | null;
  @ApiProperty({ enum: TaxObligationType, enumName: 'TaxObligationType' })
  @IsEnum(TaxObligationType) type!: TaxObligationType;
  @ApiPropertyOptional({ enum: TaxObligationStatus, enumName: 'TaxObligationStatus', default: TaxObligationStatus.PENDING, description: 'OVERDUE requires a past due date.' })
  @ValidateIf((_object, value) => value !== undefined) @IsEnum(TaxObligationStatus) status?: TaxObligationStatus;
  @ApiProperty({ format: 'date', example: '2026-10-20' })
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Must be an active user.' })
  @IsOptional() @IsUUID() responsibleUserId?: string | null;
}
