import { Transform } from 'class-transformer';
import { IsString, Length, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const whenProvided = (_object: unknown, value: unknown) => value !== undefined;

export class UpdateCountryDto {
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @ValidateIf(whenProvided) @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value) @IsString() @Length(2, 2) @Matches(/^[A-Z]{2}$/) code?: string;
}