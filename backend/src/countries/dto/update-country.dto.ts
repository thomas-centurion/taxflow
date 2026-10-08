import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const whenProvided = (_object: unknown, value: unknown) => value !== undefined;

export class UpdateCountryDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @ApiPropertyOptional({ pattern: '^[A-Z]{2}$' })
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value) @IsString() @Length(2, 2) @Matches(/^[A-Z]{2}$/) code?: string;
}
