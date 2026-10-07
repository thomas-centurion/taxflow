import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination-query.dto';
import { TaxObligationStatus } from '../tax-obligation-status.enum';
import { TaxObligationType } from '../tax-obligation-type.enum';

export class TaxObligationQueryDto extends PaginationQueryDto {
  @IsOptional() @IsUUID() company?: string;
  @IsOptional() @IsUUID() country?: string;
  @IsOptional() @IsEnum(TaxObligationStatus) status?: TaxObligationStatus;
  @IsOptional() @IsEnum(TaxObligationType) type?: TaxObligationType;
  @IsOptional() @IsUUID() responsibleUser?: string;
  @IsOptional() @Transform(({ value }) => value) @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate?: string;
}