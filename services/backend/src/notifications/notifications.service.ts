import { Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationItem } from '../contracts/index.js';
import type { CreateNotificationDto } from './dto/create-notification.dto.js';

const DEMO_KARIM = '0x7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a7f3a';
const DEMO_SAM   = '0xc4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8c4e8';

@Injectable()
export class NotificationsService {
  private readonly notifications = new Map<string, NotificationItem>();
  private idCounter = 1;

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const n1: NotificationItem = {
      id: 'notif-1',
      workerKey: DEMO_KARIM,
      type: 'payment-due',
      message: 'April 2026 salary payment ready for confirmation',
      createdAt: new Date().toISOString(),
    };

    const n2: NotificationItem = {
      id: 'notif-2',
      workerKey: DEMO_SAM,
      type: 'unconfirmed-period',
      message: 'March 2026 period remains unconfirmed on Midnight ledger',
      createdAt: new Date().toISOString(),
    };

    this.notifications.set(n1.id, n1);
    this.notifications.set(n2.id, n2);
    this.idCounter = 3;
  }

  findAll(workerKey?: string): { items: NotificationItem[]; unreadCount: number } {
    let list = Array.from(this.notifications.values());
    if (workerKey) {
      list = list.filter((n) => n.workerKey === workerKey);
    }
    const unreadCount = list.filter((n) => !n.readAt).length;
    return { items: list, unreadCount };
  }

  create(dto: CreateNotificationDto): NotificationItem {
    const id = `notif-${this.idCounter++}`;
    const item: NotificationItem = {
      id,
      workerKey: dto.workerKey,
      type: dto.type,
      message: dto.message,
      createdAt: new Date().toISOString(),
    };

    this.notifications.set(id, item);
    return item;
  }

  markRead(id: string): NotificationItem {
    const item = this.notifications.get(id);
    if (!item) {
      throw new NotFoundException(`Notification with id ${id} not found`);
    }

    item.readAt = new Date().toISOString();
    this.notifications.set(id, item);
    return item;
  }
}
