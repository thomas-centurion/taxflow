import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { TaxObligationStatus } from '../tax-obligation-status.enum';
import { TaxObligationType } from '../tax-obligation-type.enum';

const whenProvided = (_object: unknown, value: unknown) => value !== undefined;

export class UpdateTaxObligationDto {
  @ValidateIf(whenProvided) @IsUUID() companyId?: string;
  @ValidateIf(whenProvided) @IsUUID() countryId?: string;
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() description?: string | null;
  @ValidateIf(whenProvided) @IsEnum(TaxObligationType) type?: TaxObligationType;
  @ValidateIf(whenProvided) @IsEnum(TaxObligationStatus) status?: TaxObligationStatus;
  @ValidateIf(whenProvided) @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate?: string;
  @IsOptional() @IsUUID() responsibleUserId?: string | null;
}