import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  getHealth() {
    return { status: "ok" };
  }

  @Get("db")
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
