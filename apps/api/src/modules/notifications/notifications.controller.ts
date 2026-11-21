import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service.js";
import { CreateNotificationDto, MarkReadDto } from "./dto/notification.dto.js";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** POST /api/v1/notifications */
  @Post()
  create(@Body() dto: CreateNotificationDto) {
    return this.notifications.createNotification(dto);
  }

  /** GET /api/v1/notifications?userId=...&unreadOnly=...&limit=... */
  @Get()
  list(
    @Query("userId") userId: string,
    @Query("unreadOnly") unreadOnly?: string,
    @Query("limit") limit?: string,
  ) {
    return this.notifications.listForUser(
      userId,
      unreadOnly === "true",
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /** GET /api/v1/notifications/unread-count?userId=... */
  @Get("unread-count")
  unreadCount(@Query("userId") userId: string) {
    return this.notifications.getUnreadCount(userId);
  }

  /** PATCH /api/v1/notifications/:id/read */
  @Patch(":id/read")
  markAsRead(@Param("id") id: string, @Body() dto: MarkReadDto) {
    return this.notifications.markAsRead(id, dto.userId);
  }

  /** PATCH /api/v1/notifications/read-all */
  @Patch("read-all")
  markAllAsRead(@Body() dto: MarkReadDto) {
    return this.notifications.markAllAsRead(dto.userId);
  }
}
