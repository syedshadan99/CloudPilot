import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";

export interface AuditLogRow {
  id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

/**
 * Immutable Audit Repository.
 *
 * Immutability Contract:
 *  - Only INSERT and SELECT operations are permitted.
 *  - Under NO circumstances are UPDATE or DELETE queries exposed.
 *  - Underlying database rules also block direct SQL mutations.
 */
@Injectable()
export class AuditRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Append a single immutable audit entry.
   */
  async append(params: {
    actorId: string;
    actorRole?: string;
    action: string;
    entityType: string;
    entityId: string;
    oldData?: Record<string, unknown>;
    newData?: Record<string, unknown>;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLogRow> {
    const r = await this.db.query<AuditLogRow>(
      `INSERT INTO audit_logs
         (actor_id, actor_role, action, entity_type, entity_id, old_data, new_data, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        params.actorId,
        params.actorRole ?? "CUSTOMER",
        params.action,
        params.entityType,
        params.entityId,
        params.oldData ? JSON.stringify(params.oldData) : null,
        params.newData ? JSON.stringify(params.newData) : null,
        params.ipAddress ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ],
    );
    return r.rows[0]!;
  }

  async findById(id: string): Promise<AuditLogRow | undefined> {
    const r = await this.db.query<AuditLogRow>(
      `SELECT * FROM audit_logs WHERE id = $1`,
      [id],
    );
    return r.rows[0];
  }

  async listByActor(actorId: string, limit = 50): Promise<AuditLogRow[]> {
    const r = await this.db.query<AuditLogRow>(
      `SELECT * FROM audit_logs
       WHERE actor_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [actorId, limit],
    );
    return r.rows;
  }

  async listByEntity(
    entityType: string,
    entityId: string,
    limit = 50,
  ): Promise<AuditLogRow[]> {
    const r = await this.db.query<AuditLogRow>(
      `SELECT * FROM audit_logs
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [entityType, entityId, limit],
    );
    return r.rows;
  }

  async listAll(
    filters?: {
      actorId?: string;
      entityType?: string;
      action?: string;
    },
    limit = 50,
  ): Promise<AuditLogRow[]> {
    let sql = `SELECT * FROM audit_logs WHERE 1=1`;
    const params: unknown[] = [];

    if (filters?.actorId) {
      params.push(filters.actorId);
      sql += ` AND actor_id = $${params.length}`;
    }
    if (filters?.entityType) {
      params.push(filters.entityType);
      sql += ` AND entity_type = $${params.length}`;
    }
    if (filters?.action) {
      params.push(filters.action);
      sql += ` AND action = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const r = await this.db.query<AuditLogRow>(sql, params);
    return r.rows;
  }
}
