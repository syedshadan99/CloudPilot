import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import type { CreateSessionDto, CreateMessageDto } from "./dto/chat.dto.js";
import type { VmRequirements } from "./adapters/index.js";
import { ChatSessionState, BillingCycle } from "./dto/chat.dto.js";

export interface SessionRow {
  id: string;
  customer_id: string;
  state: string;
  title: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: Date;
}

export interface RequirementsRow {
  id: string;
  session_id: string;
  cpu_cores: number | null;
  ram_gb: number | null;
  storage_gb: number | null;
  os: string | null;
  duration_days: number | null;
  billing_cycle: string | null;
  use_case: string | null;
  notes: string | null;
  source: string;
  updated_at: Date;
}

@Injectable()
export class ChatRepository {
  constructor(private readonly db: DatabaseService) {}

  async createSession(dto: CreateSessionDto): Promise<SessionRow> {
    const result = await this.db.query<SessionRow>(
      `INSERT INTO chat_sessions (customer_id, title, state)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [dto.customerId, dto.title ?? null, ChatSessionState.RequirementsCollection],
    );
    return result.rows[0]!;
  }

  async listSessions(customerId: string): Promise<SessionRow[]> {
    const result = await this.db.query<SessionRow>(
      `SELECT * FROM chat_sessions WHERE customer_id = $1 ORDER BY created_at DESC`,
      [customerId],
    );
    return result.rows;
  }

  async findSession(id: string): Promise<SessionRow | undefined> {
    const result = await this.db.query<SessionRow>(
      `SELECT * FROM chat_sessions WHERE id = $1`,
      [id],
    );
    return result.rows[0];
  }

  async addMessage(
    sessionId: string,
    role: string,
    content: string,
  ): Promise<MessageRow> {
    const result = await this.db.query<MessageRow>(
      `INSERT INTO chat_messages (session_id, role, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sessionId, role, content],
    );
    return result.rows[0]!;
  }

  async listMessages(sessionId: string): Promise<MessageRow[]> {
    const result = await this.db.query<MessageRow>(
      `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId],
    );
    return result.rows;
  }

  async upsertRequirements(
    sessionId: string,
    reqs: VmRequirements,
    source: "ai" | "manual",
  ): Promise<RequirementsRow> {
    const result = await this.db.query<RequirementsRow>(
      `INSERT INTO vm_requirements
         (session_id, cpu_cores, ram_gb, storage_gb, os, duration_days, billing_cycle, use_case, notes, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (session_id) DO UPDATE SET
         cpu_cores     = COALESCE(EXCLUDED.cpu_cores,     vm_requirements.cpu_cores),
         ram_gb        = COALESCE(EXCLUDED.ram_gb,        vm_requirements.ram_gb),
         storage_gb    = COALESCE(EXCLUDED.storage_gb,    vm_requirements.storage_gb),
         os            = COALESCE(EXCLUDED.os,            vm_requirements.os),
         duration_days = COALESCE(EXCLUDED.duration_days, vm_requirements.duration_days),
         billing_cycle = COALESCE(EXCLUDED.billing_cycle, vm_requirements.billing_cycle),
         use_case      = COALESCE(EXCLUDED.use_case,      vm_requirements.use_case),
         notes         = COALESCE(EXCLUDED.notes,         vm_requirements.notes),
         source        = EXCLUDED.source,
         updated_at    = NOW()
       RETURNING *`,
      [
        sessionId,
        reqs.cpuCores ?? null,
        reqs.ramGb ?? null,
        reqs.storageGb ?? null,
        reqs.os ?? null,
        reqs.durationDays ?? null,
        reqs.billingCycle ?? null,
        reqs.useCase ?? null,
        reqs.notes ?? null,
        source,
      ],
    );
    return result.rows[0]!;
  }

  async findRequirements(sessionId: string): Promise<RequirementsRow | undefined> {
    const result = await this.db.query<RequirementsRow>(
      `SELECT * FROM vm_requirements WHERE session_id = $1`,
      [sessionId],
    );
    return result.rows[0];
  }
}
