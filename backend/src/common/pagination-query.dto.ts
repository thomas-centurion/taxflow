import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 })
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @ApiPropertyOptional({ maxLength: 100, description: 'Case-insensitive text search. The fields searched depend on the resource.' })
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(100) search?: string;
}

export interface PaginatedResult<T> { data: T[]; meta: { page: number; limit: number; total: number; pageCount: number } }
export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, pageCount: Math.ceil(total / limit) };
}
