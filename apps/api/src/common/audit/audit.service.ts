import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../database/database.service.js";

export interface AuditEvent {
  actorId: string;
  organizationId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldData?: unknown;
  newData?: unknown;
  reason?: string;
  requestId?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async record(event: AuditEvent, client?: PoolClient): Promise<void> {
    const query = `INSERT INTO audit_logs
      (actor_id, organization_id, action, entity_type, entity_id, old_data, new_data, reason, request_id)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`;
    const values = [
      event.actorId,
      event.organizationId,
      event.action,
      event.entityType,
      event.entityId,
      event.oldData ? JSON.stringify(event.oldData) : null,
      event.newData ? JSON.stringify(event.newData) : null,
      event.reason ?? null,
      event.requestId ?? null,
    ];
    if (client) {
      await client.query(query, values);
    } else {
      await this.db.query(query, values);
    }
  }
}
