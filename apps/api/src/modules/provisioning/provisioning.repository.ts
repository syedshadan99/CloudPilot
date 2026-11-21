import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import type { VmConfig } from "./adapters/index.js";

export interface JobRow {
  id: string;
  order_id: string;
  customer_id: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  vm_config: VmConfig;
  simulated_vm_id: string | null;
  simulated_host: string | null;
  simulated_ip: string | null;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

export interface AttemptRow {
  id: string;
  job_id: string;
  attempt_number: number;
  started_at: Date;
  completed_at: Date | null;
  stage_reached: string | null;
  error: string | null;
}

export type JobStatus =
  | "QUEUED"
  | "ALLOCATING"
  | "PREPARING_OS"
  | "ASSIGNING_NETWORK"
  | "BOOTING"
  | "HEALTH_CHECK"
  | "READY"
  | "FAILED"
  | "CANCELLED";

@Injectable()
export class ProvisioningRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a job. UNIQUE(order_id) makes this idempotent:
   * repeated calls for the same order return the existing row.
   */
  async createJob(
    orderId: string,
    customerId: string,
    vmConfig: VmConfig,
  ): Promise<JobRow> {
    const result = await this.db.query<JobRow>(
      `INSERT INTO provisioning_jobs (order_id, customer_id, vm_config)
       VALUES ($1, $2, $3)
       ON CONFLICT (order_id) DO UPDATE
         SET updated_at = provisioning_jobs.updated_at  -- no-op, returns existing row
       RETURNING *`,
      [orderId, customerId, JSON.stringify(vmConfig)],
    );
    return result.rows[0]!;
  }

  async findById(id: string): Promise<JobRow | undefined> {
    const r = await this.db.query<JobRow>(
      `SELECT * FROM provisioning_jobs WHERE id = $1`,
      [id],
    );
    return r.rows[0];
  }

  async findByOrderId(orderId: string): Promise<JobRow | undefined> {
    const r = await this.db.query<JobRow>(
      `SELECT * FROM provisioning_jobs WHERE order_id = $1`,
      [orderId],
    );
    return r.rows[0];
  }

  /** Pick up to `limit` jobs that need processing (QUEUED or stuck in-progress). */
  async listPickable(limit = 5): Promise<JobRow[]> {
    const r = await this.db.query<JobRow>(
      `SELECT * FROM provisioning_jobs
       WHERE status = 'QUEUED'
         AND attempt_count < max_attempts
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit],
    );
    return r.rows;
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    extra: Partial<Pick<JobRow, "last_error" | "simulated_vm_id" | "simulated_host" | "simulated_ip" | "started_at" | "completed_at">> = {},
  ): Promise<JobRow> {
    const sets: string[] = ["status = $2", "updated_at = NOW()"];
    const values: unknown[] = [id, status];
    let idx = 3;

    if ("last_error" in extra) { sets.push(`last_error = $${idx++}`); values.push(extra.last_error ?? null); }
    if ("simulated_vm_id" in extra) { sets.push(`simulated_vm_id = $${idx++}`); values.push(extra.simulated_vm_id ?? null); }
    if ("simulated_host" in extra) { sets.push(`simulated_host = $${idx++}`); values.push(extra.simulated_host ?? null); }
    if ("simulated_ip" in extra) { sets.push(`simulated_ip = $${idx++}`); values.push(extra.simulated_ip ?? null); }
    if ("started_at" in extra) { sets.push(`started_at = $${idx++}`); values.push(extra.started_at ?? null); }
    if ("completed_at" in extra) { sets.push(`completed_at = $${idx++}`); values.push(extra.completed_at ?? null); }

    const r = await this.db.query<JobRow>(
      `UPDATE provisioning_jobs SET ${sets.join(", ")}, attempt_count = attempt_count + 1
       WHERE id = $1
       RETURNING *`,
      values,
    );
    return r.rows[0]!;
  }

  async recordAttempt(
    jobId: string,
    attemptNumber: number,
    stageReached: string,
    error?: string,
  ): Promise<AttemptRow> {
    const r = await this.db.query<AttemptRow>(
      `INSERT INTO job_attempts (job_id, attempt_number, stage_reached, error, completed_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [jobId, attemptNumber, stageReached, error ?? null],
    );
    return r.rows[0]!;
  }

  async listAttempts(jobId: string): Promise<AttemptRow[]> {
    const r = await this.db.query<AttemptRow>(
      `SELECT * FROM job_attempts WHERE job_id = $1 ORDER BY attempt_number ASC`,
      [jobId],
    );
    return r.rows;
  }
}
