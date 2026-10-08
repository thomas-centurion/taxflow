import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Error body produced by NestJS for every failed request (the API keeps the framework's default format). */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 }) statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Tax obligation not found.',
    description: 'Human-readable reason. Validation errors (400) return one message per invalid field.',
  })
  message!: string | string[];

  @ApiPropertyOptional({ example: 'Not Found', description: 'HTTP reason phrase. Omitted by some errors, such as 429.' }) error?: string;
}
