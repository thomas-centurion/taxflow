import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { AuditAction } from '../audit-action.enum';

export class AuditLogQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
  @IsOptional() @IsString() @MaxLength(100) entityType?: string;
  @IsOptional() @IsUUID() entityId?: string;
  @IsOptional() @IsUUID() actor?: string;
  @IsOptional() @IsDateString({ strict: true }) dateFrom?: string;
  @IsOptional() @IsDateString({ strict: true }) dateTo?: string;
}
