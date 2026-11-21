import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { NotificationsRepository, type NotificationRow } from "./notifications.repository.js";
import type { CreateNotificationDto } from "./dto/notification.dto.js";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly repo: NotificationsRepository) {}

  async createNotification(dto: CreateNotificationDto): Promise<NotificationRow> {
    const n = await this.repo.create(dto);
    this.logger.log(`Notification ${n.id} created for user ${n.user_id} (${n.type})`);
    return n;
  }

  async listForUser(
    userId: string,
    unreadOnly = false,
    limit = 50,
  ): Promise<NotificationRow[]> {
    return this.repo.listByUser(userId, unreadOnly, limit);
  }

  async markAsRead(id: string, userId: string): Promise<NotificationRow> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    if (existing.user_id !== userId) {
      throw new ForbiddenException("You cannot access another user's notifications");
    }

    // Already marked read
    if (existing.read_at) {
      return existing;
    }

    const updated = await this.repo.markAsRead(id, userId);
    return updated || existing;
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const count = await this.repo.markAllAsRead(userId);
    return { count };
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const count = await this.repo.countUnread(userId);
    return { unreadCount: count };
  }
}
