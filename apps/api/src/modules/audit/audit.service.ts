import {
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { AuditRepository, type AuditLogRow } from "./audit.repository.js";
import type { AppendAuditLogDto, QueryAuditLogsDto } from "./dto/audit-log.dto.js";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repo: AuditRepository) {}

  /**
   * Append an immutable audit log entry.
   */
  async append(dto: AppendAuditLogDto): Promise<AuditLogRow> {
    const row = await this.repo.append(dto);
    this.logger.log(
      `Audit log ${row.id} appended: [${row.action}] on ${row.entity_type}:${row.entity_id} by ${row.actor_id}`,
    );
    return row;
  }

  /**
   * Scoped audit log queries:
   *  - Customers can ONLY query their own actions (actor_id == customerId).
   *  - Providers can query all actions and filter across entities and actors.
   */
  async queryLogs(dto: QueryAuditLogsDto): Promise<AuditLogRow[]> {
    const role = (dto.role || "CUSTOMER").toUpperCase();
    const limit = dto.limit ? parseInt(dto.limit, 10) : 50;

    if (role === "CUSTOMER") {
      // Customers can only see their own audit entries
      return this.repo.listByActor(dto.actorId, limit);
    }

    if (role === "PROVIDER") {
      return this.repo.listAll(
        {
          actorId: dto.actorId === "ALL" ? undefined : dto.actorId,
          entityType: dto.entityType,
          action: dto.action,
        },
        limit,
      );
    }

    throw new ForbiddenException("Unauthorized role for querying audit logs");
  }

  /**
   * Retrieve audit history for a specific entity.
   * Access check: Customers can only query entity audit history if they are the actor or owner.
   */
  async getEntityHistory(
    entityType: string,
    entityId: string,
    actorId: string,
    role = "CUSTOMER",
    limit = 50,
  ): Promise<AuditLogRow[]> {
    const isProvider = role.toUpperCase() === "PROVIDER";
    const history = await this.repo.listByEntity(entityType, entityId, limit);

    if (isProvider) {
      return history;
    }

    // Customer can only view entries where they are the actor
    return history.filter((entry) => entry.actor_id === actorId);
  }
}
