import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ format: 'email', maxLength: 254, example: 'admin@taxflow.local' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ format: 'password', minLength: 1, maxLength: 72, description: 'Development seed users use SEED_USER_PASSWORD from .env.' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
