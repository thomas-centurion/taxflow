import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength, Matches, ValidateIf } from 'class-validator';
import { TaxObligationStatus } from '../tax-obligation-status.enum';
import { TaxObligationType } from '../tax-obligation-type.enum';

export class CreateTaxObligationDto {
  @IsUUID() companyId!: string;
  @IsUUID() countryId!: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() description?: string | null;
  @IsEnum(TaxObligationType) type!: TaxObligationType;
  @ValidateIf((_object, value) => value !== undefined) @IsEnum(TaxObligationStatus) status?: TaxObligationStatus;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate!: string;
  @IsOptional() @IsUUID() responsibleUserId?: string | null;
}