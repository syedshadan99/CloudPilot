import { Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import { Pool, type QueryResult, type QueryResultRow } from "pg";

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

  /**
   * Execute a parameterised SQL query and return the full pg QueryResult.
   * Use this for all domain data access instead of importing pg directly.
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, values);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
