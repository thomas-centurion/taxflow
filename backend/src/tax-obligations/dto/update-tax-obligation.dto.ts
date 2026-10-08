import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { TaxObligationStatus } from '../tax-obligation-status.enum';
import { TaxObligationType } from '../tax-obligation-type.enum';

const whenProvided = (_object: unknown, value: unknown) => value !== undefined;

export class UpdateTaxObligationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(whenProvided) @IsUUID() companyId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(whenProvided) @IsUUID() countryId?: string;
  @ApiPropertyOptional({ minLength: 1, maxLength: 200 })
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() description?: string | null;
  @ApiPropertyOptional({ enum: TaxObligationType, enumName: 'TaxObligationType' })
  @ValidateIf(whenProvided) @IsEnum(TaxObligationType) type?: TaxObligationType;
  @ApiPropertyOptional({ enum: TaxObligationStatus, enumName: 'TaxObligationStatus', description: 'Must be an allowed transition from the current status.' })
  @ValidateIf(whenProvided) @IsEnum(TaxObligationStatus) status?: TaxObligationStatus;
  @ApiPropertyOptional({ format: 'date', example: '2026-10-20' })
  @ValidateIf(whenProvided) @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Active user, or null to unassign.' })
  @IsOptional() @IsUUID() responsibleUserId?: string | null;
}
