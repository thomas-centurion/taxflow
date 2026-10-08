import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { ApiErrorResponses, ApiJwtAuth } from '../common/swagger/api-docs.decorators';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { MarkAllReadResponseDto, NotificationResponseDto, PaginatedNotificationsDto } from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

/** Every endpoint only sees and changes the authenticated user's own notifications. */
@ApiTags('Notifications')
@ApiJwtAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiOperation({ summary: 'Lists the notifications of the authenticated user, newest first.' })
  @Get()
  @ApiOkResponse({ type: PaginatedNotificationsDto })
  @ApiErrorResponses(400)
  findAll(@CurrentUser() user: AuthUser, @Query() query: NotificationQueryDto) { return this.notifications.findAll(user, query); }

  @ApiOperation({ summary: 'Counts the unread notifications of the authenticated user.' })
  @Get('unread-count')
  @ApiOkResponse({ schema: { type: 'integer', example: 3 } })
  unreadCount(@CurrentUser() user: AuthUser) { return this.notifications.unreadCount(user); }

  @ApiOperation({ summary: 'Marks all notifications of the authenticated user as read.' })
  @Patch('read-all')
  @ApiOkResponse({ type: MarkAllReadResponseDto })
  markAllRead(@CurrentUser() user: AuthUser) { return this.notifications.markAllRead(user); }

  @ApiOperation({ summary: 'Marks one notification as read.', description: 'Notifications of other users answer 404, like missing ones.' })
  @Patch(':id/read')
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiErrorResponses(400, 404)
  markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.notifications.markRead(user, id); }
}
