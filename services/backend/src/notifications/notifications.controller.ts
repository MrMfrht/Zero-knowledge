import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import type { NotificationItem } from '../contracts/index.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @Query('workerKey') workerKey?: string,
  ): { items: NotificationItem[]; unreadCount: number } {
    return this.notificationsService.findAll(workerKey);
  }

  @Post()
  create(@Body() dto: CreateNotificationDto): NotificationItem {
    return this.notificationsService.create(dto);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string): NotificationItem {
    return this.notificationsService.markRead(id);
  }
}
