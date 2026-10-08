import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { AuditAction } from '../audit-action.enum';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class AuditLogQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @ApiPropertyOptional({ enum: AuditAction, enumName: 'AuditAction' })
  @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
  @ApiPropertyOptional({ maxLength: 100, description: 'Entity type, e.g. TaxObligation, Company, Document, Notification, AutomationRun or User.' })
  @IsOptional() @IsString() @MaxLength(100) entityType?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID() entityId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'ID of the acting user.' })
  @IsOptional() @IsUUID() actor?: string;
  @ApiPropertyOptional({ format: 'date', example: '2026-10-01', description: 'Inclusive, backend timezone.' })
  @IsOptional() @IsDateString({ strict: true }) @Matches(DATE_ONLY, { message: 'dateFrom must use the YYYY-MM-DD format' }) dateFrom?: string;
  @ApiPropertyOptional({ format: 'date', example: '2026-10-31', description: 'Inclusive, backend timezone.' })
  @IsOptional() @IsDateString({ strict: true }) @Matches(DATE_ONLY, { message: 'dateTo must use the YYYY-MM-DD format' }) dateTo?: string;
}
