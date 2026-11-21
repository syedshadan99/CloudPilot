import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { AuditService } from "./audit.service.js";
import { AppendAuditLogDto, QueryAuditLogsDto } from "./dto/audit-log.dto.js";

@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** POST /api/v1/audit/logs - Internal or admin event append */
  @Post("logs")
  append(@Body() dto: AppendAuditLogDto) {
    return this.audit.append(dto);
  }

  /** GET /api/v1/audit/logs?actorId=...&role=...&entityType=...&action=... */
  @Get("logs")
  queryLogs(@Query() query: QueryAuditLogsDto) {
    return this.audit.queryLogs(query);
  }

  /** GET /api/v1/audit/logs/entity/:entityType/:entityId?actorId=...&role=... */
  @Get("logs/entity/:entityType/:entityId")
  getEntityHistory(
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
    @Query("actorId") actorId: string,
    @Query("role") role?: string,
    @Query("limit") limit?: string,
  ) {
    return this.audit.getEntityHistory(
      entityType,
      entityId,
      actorId,
      role ?? "CUSTOMER",
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
