import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PaginationQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(100) search?: string;
}

export interface PaginatedResult<T> { data: T[]; meta: { page: number; limit: number; total: number; pageCount: number } }
export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, pageCount: Math.ceil(total / limit) };
}