import { ApiProperty } from '@nestjs/swagger';

export class PersonSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Taylor' }) firstName!: string;
  @ApiProperty({ example: 'Manager' }) lastName!: string;
}
