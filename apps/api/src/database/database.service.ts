import { Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

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

  /**
   * Run related writes on one checked-out PostgreSQL connection.  A transaction
   * cannot be composed from independent pool.query calls because each call may
   * use a different connection.
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        this.logger.error(
          `PostgreSQL rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
