import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { AuditAction } from '../audit-action.enum';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class AuditLogQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
  @IsOptional() @IsString() @MaxLength(100) entityType?: string;
  @IsOptional() @IsUUID() entityId?: string;
  @IsOptional() @IsUUID() actor?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(DATE_ONLY, { message: 'dateFrom must use the YYYY-MM-DD format' }) dateFrom?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(DATE_ONLY, { message: 'dateTo must use the YYYY-MM-DD format' }) dateTo?: string;
}
