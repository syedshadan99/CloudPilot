import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import { calculateMonthlyPrice, type VmSpec } from "./pricing-calculator.js";

const statusToDatabase: Record<UpgradeRequestRow["status"], string> = {
  PENDING_APPROVAL: "requested",
  APPROVED: "approved",
  RESIZING: "processing",
  COMPLETED: "applied",
  FAILED: "failed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
};

const statusFromDatabase: Record<string, UpgradeRequestRow["status"]> = {
  requested: "PENDING_APPROVAL",
  approved: "APPROVED",
  processing: "RESIZING",
  applied: "COMPLETED",
  failed: "FAILED",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
};

function monthlyPrice(configuration: Record<string, unknown>): string {
  return calculateMonthlyPrice({
    cpuCores: Number(configuration.cpuCores ?? configuration.cpu_cores ?? 0),
    ramGb: Number(configuration.ramGb ?? configuration.ram_gb ?? 0),
    storageGb: Number(configuration.storageGb ?? configuration.storage_gb ?? 0),
  }).toFixed(2);
}

function mapRow(row: Record<string, any>): UpgradeRequestRow {
  const oldConfiguration = row.previous_configuration ?? {};
  const newConfiguration = row.requested_configuration ?? {};
  const status = statusFromDatabase[row.status] ?? row.status;

  return {
    id: row.id,
    customer_id: row.customer_id,
    vm_id: row.vm_id,
    old_configuration: oldConfiguration,
    new_configuration: newConfiguration,
    old_monthly_price: monthlyPrice(oldConfiguration),
    new_monthly_price: monthlyPrice(newConfiguration),
    price_difference: String(row.price_difference),
    status,
    customer_confirmed_at: row.customer_confirmed_at ?? row.requested_at ?? null,
    provider_approved_at: row.approved_at ?? null,
    approved_by: row.reviewed_by ?? null,
    rejection_reason: status === "REJECTED" ? row.failure_reason ?? null : null,
    attempt_count: Number(row.attempt_count ?? 0),
    max_attempts: Number(row.max_attempts ?? 3),
    last_error: status === "FAILED" ? row.failure_reason ?? row.last_error ?? null : row.last_error ?? null,
    started_at: row.started_at ?? null,
    completed_at: row.completed_at ?? row.effective_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export interface UpgradeRequestRow {
  id: string;
  customer_id: string;
  vm_id: string;
  old_configuration: VmSpec & { os?: string };
  new_configuration: VmSpec & { os?: string };
  old_monthly_price: string;
  new_monthly_price: string;
  price_difference: string;
  status:
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "RESIZING"
    | "COMPLETED"
    | "FAILED"
    | "REJECTED"
    | "CANCELLED";
  customer_confirmed_at: Date | null;
  provider_approved_at: Date | null;
  approved_by: string | null;
  rejection_reason: string | null;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class UpgradesRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(params: {
    customerId: string;
    vmId: string;
    oldConfig: VmSpec & { os?: string };
    newConfig: VmSpec & { os?: string };
    oldMonthlyPrice: number;
    newMonthlyPrice: number;
    priceDifference: number;
  }): Promise<UpgradeRequestRow> {
    const r = await this.db.query<UpgradeRequestRow>(
      `INSERT INTO upgrade_requests
         (customer_id, vm_id, previous_configuration, requested_configuration,
          price_difference, currency, status, requested_at, customer_confirmed_at)
       VALUES ($1, $2, $3, $4, $5, 'USD', 'requested', NOW(), NOW())
       RETURNING *`,
      [
        params.customerId,
        params.vmId,
        JSON.stringify(params.oldConfig),
        JSON.stringify(params.newConfig),
        params.priceDifference,
      ],
    );
    return mapRow(r.rows[0] as unknown as Record<string, any>);
  }

  async findById(id: string): Promise<UpgradeRequestRow | undefined> {
    const r = await this.db.query<UpgradeRequestRow>(
      `SELECT * FROM upgrade_requests WHERE id = $1`,
      [id],
    );
    return r.rows[0] ? mapRow(r.rows[0] as unknown as Record<string, any>) : undefined;
  }

  async findActiveByVmId(vmId: string): Promise<UpgradeRequestRow | undefined> {
    const r = await this.db.query<UpgradeRequestRow>(
      `SELECT * FROM upgrade_requests
       WHERE vm_id = $1 AND status IN ('requested', 'approved', 'processing')
       LIMIT 1`,
      [vmId],
    );
    return r.rows[0] ? mapRow(r.rows[0] as unknown as Record<string, any>) : undefined;
  }

  async listByCustomer(customerId: string): Promise<UpgradeRequestRow[]> {
    const r = await this.db.query<UpgradeRequestRow>(
      `SELECT * FROM upgrade_requests WHERE customer_id = $1 ORDER BY created_at DESC`,
      [customerId],
    );
    return r.rows.map((row) => mapRow(row as unknown as Record<string, any>));
  }

  async listByVm(vmId: string): Promise<UpgradeRequestRow[]> {
    const r = await this.db.query<UpgradeRequestRow>(
      `SELECT * FROM upgrade_requests WHERE vm_id = $1 ORDER BY created_at DESC`,
      [vmId],
    );
    return r.rows.map((row) => mapRow(row as unknown as Record<string, any>));
  }

  async updateStatus(
    id: string,
    status: UpgradeRequestRow["status"],
    fields: Partial<
      Pick<
        UpgradeRequestRow,
        | "provider_approved_at"
        | "approved_by"
        | "customer_confirmed_at"
        | "rejection_reason"
        | "last_error"
        | "started_at"
        | "completed_at"
      >
    > = {},
  ): Promise<UpgradeRequestRow> {
    const sets = ["status = $2", "updated_at = NOW()"];
    const vals: unknown[] = [id, statusToDatabase[status]];
    let idx = 3;

    if ("provider_approved_at" in fields) {
      sets.push(`approved_at = $${idx++}`);
      vals.push(fields.provider_approved_at);
    }
    if ("approved_by" in fields) {
      sets.push(`reviewed_by = $${idx++}`);
      vals.push(fields.approved_by);
    }
    if ("customer_confirmed_at" in fields) {
      sets.push(`customer_confirmed_at = $${idx++}`);
      vals.push(fields.customer_confirmed_at);
    }
    if ("rejection_reason" in fields) {
      sets.push(`failure_reason = $${idx++}`);
      vals.push(fields.rejection_reason);
    }
    if ("last_error" in fields) {
      sets.push(`failure_reason = $${idx++}`);
      vals.push(fields.last_error);
    }
    if ("started_at" in fields) {
      sets.push(`started_at = $${idx++}`);
      vals.push(fields.started_at);
    }
    if ("completed_at" in fields) {
      sets.push(`completed_at = $${idx++}`);
      vals.push(fields.completed_at);
    }

    const r = await this.db.query<UpgradeRequestRow>(
      `UPDATE upgrade_requests SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
      vals,
    );
    return mapRow(r.rows[0] as unknown as Record<string, any>);
  }

  async recordAttempt(id: string, attemptCount: number): Promise<void> {
    await this.db.query(
      `UPDATE upgrade_requests
       SET attempt_count = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, attemptCount],
    );
  }
}
