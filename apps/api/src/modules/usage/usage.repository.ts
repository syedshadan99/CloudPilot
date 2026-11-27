import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import { generateUsageMetrics, currentHourStart } from "./usage-generator.js";

export interface UsageRecordRow {
  id: string;
  vm_id: string;
  period_start: Date;
  period_end: Date;
  cpu_percent: number;
  ram_percent: number;
  disk_read_mb: number;
  disk_write_mb: number;
  net_in_mb: number;
  net_out_mb: number;
  created_at: Date;
}

@Injectable()
export class UsageRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Insert one usage record for the given period.
   * ON CONFLICT (vm_id, period_start) DO NOTHING — idempotent.
   */
  async upsertRecord(
    vmId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<UsageRecordRow | undefined> {
    const m = generateUsageMetrics(vmId, periodStart);
    const r = await this.db.query<UsageRecordRow>(
      `INSERT INTO usage_records
         (vm_id, period_start, period_end, runtime_seconds,
          cpu_percent, ram_percent,
          disk_read_mb, disk_write_mb,
          net_in_mb, net_out_mb)
       SELECT $1,$2,$3,
              CASE WHEN vm.state = 'RUNNING' AND (vm.started_at IS NULL OR vm.started_at < $3)
                   THEN GREATEST(0, LEAST(3600, EXTRACT(EPOCH FROM ($3::timestamptz - GREATEST($2::timestamptz, COALESCE(vm.started_at, $2::timestamptz)))))::bigint)
                   ELSE 0 END,
              $4,$5,$6,$7,$8,$9
         FROM virtual_machines vm WHERE vm.id = $1
       ON CONFLICT (vm_id, period_start) DO NOTHING
       RETURNING *`,
      [
        vmId,
        periodStart.toISOString(),
        periodEnd.toISOString(),
        m.cpu_percent,
        m.ram_percent,
        m.disk_read_mb,
        m.disk_write_mb,
        m.net_in_mb,
        m.net_out_mb,
      ],
    );
    return r.rows[0];
  }

  /**
   * Write the usage record for the current UTC hour (idempotent).
   */
  async generateHourlyTick(vmId: string): Promise<UsageRecordRow | undefined> {
    const start = currentHourStart();
    const end = new Date(start.getTime() + 3_600_000); // +1 hour
    return this.upsertRecord(vmId, start, end);
  }

  /**
   * List recent usage records for a VM, newest first.
   */
  async listByVm(
    vmId: string,
    limit = 48,
  ): Promise<UsageRecordRow[]> {
    const r = await this.db.query<UsageRecordRow>(
      `SELECT * FROM usage_records
        WHERE vm_id = $1
        ORDER BY period_start DESC
        LIMIT $2`,
      [vmId, limit],
    );
    return r.rows;
  }
}
