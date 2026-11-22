import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import type { TicketPriority, TicketStatus } from "./dto/support-ticket.dto.js";

export interface SupportTicketRow {
  id: string;
  customer_id: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SupportTicketMessageRow {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: Date;
}

@Injectable()
export class SupportRepository {
  constructor(private readonly db: DatabaseService) {}

  async createTicket(params: {
    customerId: string;
    subject: string;
    description: string;
    priority?: TicketPriority;
  }): Promise<SupportTicketRow> {
    const r = await this.db.query<SupportTicketRow>(
      `INSERT INTO support_tickets
         (customer_id, subject, description, priority, status)
       VALUES ($1, $2, $3, $4, 'OPEN')
       RETURNING *`,
      [
        params.customerId,
        params.subject,
        params.description,
        params.priority ?? "MEDIUM",
      ],
    );
    return r.rows[0]!;
  }

  async findById(id: string): Promise<SupportTicketRow | undefined> {
    const r = await this.db.query<SupportTicketRow>(
      `SELECT * FROM support_tickets WHERE id = $1`,
      [id],
    );
    return r.rows[0];
  }

  async listByCustomer(customerId: string): Promise<SupportTicketRow[]> {
    const r = await this.db.query<SupportTicketRow>(
      `SELECT * FROM support_tickets
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customerId],
    );
    return r.rows;
  }

  async listAll(filters?: {
    status?: string;
    assignedTo?: string;
    priority?: string;
  }): Promise<SupportTicketRow[]> {
    let sql = `SELECT * FROM support_tickets WHERE 1=1`;
    const params: unknown[] = [];

    if (filters?.status) {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    }
    if (filters?.assignedTo) {
      params.push(filters.assignedTo);
      sql += ` AND assigned_to = $${params.length}`;
    }
    if (filters?.priority) {
      params.push(filters.priority);
      sql += ` AND priority = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC`;
    const r = await this.db.query<SupportTicketRow>(sql, params);
    return r.rows;
  }

  async updateStatus(
    id: string,
    status: TicketStatus,
    resolutionNotes?: string,
  ): Promise<SupportTicketRow | undefined> {
    const r = await this.db.query<SupportTicketRow>(
      `UPDATE support_tickets
       SET status = $2,
           resolution_notes = COALESCE($3, resolution_notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, resolutionNotes ?? null],
    );
    return r.rows[0];
  }

  async assignTicket(
    id: string,
    assignedTo: string,
  ): Promise<SupportTicketRow | undefined> {
    const r = await this.db.query<SupportTicketRow>(
      `UPDATE support_tickets
       SET assigned_to = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, assignedTo],
    );
    return r.rows[0];
  }

  async addMessage(params: {
    ticketId: string;
    senderId: string;
    senderRole: string;
    message: string;
  }): Promise<SupportTicketMessageRow> {
    const r = await this.db.query<SupportTicketMessageRow>(
      `INSERT INTO support_ticket_messages
         (ticket_id, sender_id, sender_role, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        params.ticketId,
        params.senderId,
        params.senderRole,
        params.message,
      ],
    );
    return r.rows[0]!;
  }

  async listMessages(ticketId: string): Promise<SupportTicketMessageRow[]> {
    const r = await this.db.query<SupportTicketMessageRow>(
      `SELECT * FROM support_ticket_messages
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [ticketId],
    );
    return r.rows;
  }
}
