import {
  Controller,
  Get,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { Public } from "../common/decorators/index.js";

/**
 * Infrastructure health endpoints.
 *
 * These endpoints are version-neutral and excluded from the `/api` global
 * prefix so container orchestrators and load balancers can probe them at
 * their canonical paths:
 *
 *   GET /health      — API process liveness
 *   GET /health/db   — PostgreSQL reachability
 */
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @Public()
  getHealth() {
    return { status: "ok" };
  }

  @Get("db")
  @Public()
  async getDatabaseHealth() {
    try {
      await this.database.checkConnection();
    } catch {
      throw new ServiceUnavailableException({
        status: "unavailable",
        database: "unreachable",
      });
    }

    return { status: "ok", database: "reachable" };
  }
}
