import { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResult } from '../pagination-query.dto';

export class PaginationMetaDto implements Readonly<PaginatedResult<unknown>['meta']> {
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 42, description: 'Total number of matching items.' }) total!: number;
  @ApiProperty({ example: 3 }) pageCount!: number;
}

/** Builds the `{ data, meta }` envelope used by every paginated list endpoint. */
export function PaginatedResponseDto<T>(item: Type<T>) {
  abstract class PaginatedResponse {
    @ApiProperty({ type: [item] }) data!: T[];
    @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
  }
  return PaginatedResponse;
}
