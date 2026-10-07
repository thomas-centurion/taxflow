import { Transform } from 'class-transformer';
import { IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCountryDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value) @IsString() @Length(2, 2) @Matches(/^[A-Z]{2}$/) code!: string;
}