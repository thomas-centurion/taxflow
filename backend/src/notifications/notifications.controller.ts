import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get() findAll(@CurrentUser() user: AuthUser, @Query() query: NotificationQueryDto) { return this.notifications.findAll(user, query); }
  @Get('unread-count') unreadCount(@CurrentUser() user: AuthUser) { return this.notifications.unreadCount(user); }
  @Patch('read-all') markAllRead(@CurrentUser() user: AuthUser) { return this.notifications.markAllRead(user); }
  @Patch(':id/read') markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.notifications.markRead(user, id); }
}
