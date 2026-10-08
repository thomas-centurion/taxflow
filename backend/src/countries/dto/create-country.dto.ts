import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCountryDto {
  @ApiProperty({ minLength: 1, maxLength: 120, example: 'Argentina' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @ApiProperty({ pattern: '^[A-Z]{2}$', example: 'AR', description: 'ISO 3166-1 alpha-2 code (normalized to upper case).' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value) @IsString() @Length(2, 2) @Matches(/^[A-Z]{2}$/) code!: string;
}
