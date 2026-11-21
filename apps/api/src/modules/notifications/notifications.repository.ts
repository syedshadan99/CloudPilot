import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import type { NotificationRole } from "./dto/notification.dto.js";

export interface NotificationRow {
  id: string;
  user_id: string;
  role: string;
  type: string;
  title: string;
  message: string;
  read_at: Date | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(params: {
    userId: string;
    role?: NotificationRole | string;
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<NotificationRow> {
    const r = await this.db.query<NotificationRow>(
      `INSERT INTO notifications
         (user_id, role, type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.userId,
        params.role ?? "CUSTOMER",
        params.type,
        params.title,
        params.message,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ],
    );
    return r.rows[0]!;
  }

  async findById(id: string): Promise<NotificationRow | undefined> {
    const r = await this.db.query<NotificationRow>(
      `SELECT * FROM notifications WHERE id = $1`,
      [id],
    );
    return r.rows[0];
  }

  async listByUser(
    userId: string,
    unreadOnly = false,
    limit = 50,
  ): Promise<NotificationRow[]> {
    let sql = `SELECT * FROM notifications WHERE user_id = $1`;
    const params: unknown[] = [userId];

    if (unreadOnly) {
      sql += ` AND read_at IS NULL`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const r = await this.db.query<NotificationRow>(sql, params);
    return r.rows;
  }

  async markAsRead(id: string, userId: string): Promise<NotificationRow | undefined> {
    const r = await this.db.query<NotificationRow>(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL
       RETURNING *`,
      [id, userId],
    );
    return r.rows[0];
  }

  async markAllAsRead(userId: string): Promise<number> {
    const r = await this.db.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return r.rowCount ?? 0;
  }

  async countUnread(userId: string): Promise<number> {
    const r = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return parseInt(r.rows[0]?.count ?? "0", 10);
  }
}
