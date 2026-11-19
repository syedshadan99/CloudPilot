import { Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import { Pool } from "pg";

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool = new Pool({
    connectionTimeoutMillis: 2000,
    query_timeout: 2000,
  });

  constructor() {
    this.pool.on("error", (error) => {
      this.logger.warn(`An idle PostgreSQL connection closed: ${error.message}`);
    });
  }

  async checkConnection(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
