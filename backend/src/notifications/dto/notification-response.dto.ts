import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../common/swagger/paginated-response.dto';
import { NotificationType } from '../notification-type.enum';
import { NotificationView } from '../notifications.service';

export class NotificationObligationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'IVA mensual — octubre' }) name!: string;
}

export class NotificationResponseDto implements NotificationView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Vencimiento urgente — 3 días' }) title!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' }) type!: NotificationType;
  @ApiProperty() isRead!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: NotificationObligationDto, nullable: true, description: 'Related obligation, or null when there is none or it was deleted.' })
  taxObligation!: NotificationObligationDto | null;
}

export class PaginatedNotificationsDto extends PaginatedResponseDto(NotificationResponseDto) {}

export class MarkAllReadResponseDto {
  @ApiProperty({ example: 4, description: 'Notifications that were unread and are now read.' }) updated!: number;
}
