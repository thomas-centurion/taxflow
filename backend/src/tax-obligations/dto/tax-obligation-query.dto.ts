import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination-query.dto';
import { TaxObligationStatus } from '../tax-obligation-status.enum';
import { TaxObligationType } from '../tax-obligation-type.enum';

export class TaxObligationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Company ID.' })
  @IsOptional() @IsUUID() company?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Country ID.' })
  @IsOptional() @IsUUID() country?: string;
  @ApiPropertyOptional({ enum: TaxObligationStatus, enumName: 'TaxObligationStatus' })
  @IsOptional() @IsEnum(TaxObligationStatus) status?: TaxObligationStatus;
  @ApiPropertyOptional({ enum: TaxObligationType, enumName: 'TaxObligationType' })
  @IsOptional() @IsEnum(TaxObligationType) type?: TaxObligationType;
  @ApiPropertyOptional({ format: 'uuid', description: 'Responsible user ID.' })
  @IsOptional() @IsUUID() responsibleUser?: string;
  @ApiPropertyOptional({ format: 'date', example: '2026-10-20', description: 'Exact due date.' })
  @IsOptional() @Transform(({ value }) => value) @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate?: string;
}
