import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../common/swagger/paginated-response.dto';
import { AuditAction, AuditActorType } from '../audit-action.enum';
import { AuditLogView } from '../audit-log.service';

export class AuditActorDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
}

export class AuditLogResponseDto implements AuditLogView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['USER', 'SYSTEM'] }) actorType!: AuditActorType;
  @ApiProperty({ type: String, nullable: true, description: 'Email of the acting user at the time of the event.' }) actorEmail!: string | null;
  @ApiProperty({ type: AuditActorDto, nullable: true, description: 'Null for SYSTEM events and deleted users.' }) actor!: AuditActorDto | null;
  @ApiProperty({ enum: AuditAction, enumName: 'AuditAction' }) action!: AuditAction;
  @ApiProperty({ example: 'TaxObligation' }) entity!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) entityId!: string | null;
  @ApiProperty({
    type: 'object', additionalProperties: true, nullable: true,
    description: 'Event details, e.g. `{ changes: { status: { before, after } } }`. Never contains passwords, tokens or secrets.',
  })
  metadata!: Record<string, unknown> | null;
  @ApiProperty() createdAt!: Date;
}

export class PaginatedAuditLogsDto extends PaginatedResponseDto(AuditLogResponseDto) {}
