import { ApiProperty } from '@nestjs/swagger';
import { PersonSummaryDto } from '../../common/swagger/person-summary.dto';
import { DocumentResponse } from '../documents.service';

/** Document metadata. The storage path is internal and never returned. */
export class DocumentResponseDto implements DocumentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'declaracion-iva-octubre.pdf', description: 'Sanitized original file name.' }) originalFilename!: string;
  @ApiProperty({ example: 'application/pdf' }) mimeType!: string;
  @ApiProperty({ example: 48213, description: 'Size in bytes.' }) size!: number;
  @ApiProperty({ format: 'uuid' }) taxObligationId!: string;
  @ApiProperty({ type: PersonSummaryDto }) uploadedBy!: PersonSummaryDto;
  @ApiProperty() createdAt!: Date;
}
