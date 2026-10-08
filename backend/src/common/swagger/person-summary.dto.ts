import { ApiProperty } from '@nestjs/swagger';

/** Name of the user related to a record (uploader, requester). */
export class PersonSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Taylor' }) firstName!: string;
  @ApiProperty({ example: 'Manager' }) lastName!: string;
}
