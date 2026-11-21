import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import type { VmSpec } from "./pricing-calculator.js";

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
         (customer_id, vm_id, old_configuration, new_configuration,
          old_monthly_price, new_monthly_price, price_difference,
          status, customer_confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_APPROVAL', NOW())
       RETURNING *`,
      [
        params.customerId,
        params.vmId,
        JSON.stringify(params.oldConfig),
        JSON.stringify(params.newConfig),
        params.oldMonthlyPrice,
        params.newMonthlyPrice,
        params.priceDifference,
      ],
    );
    return r.rows[0]!;
  }

  async findById(id: string): Promise<UpgradeRequestRow | undefined> {
    const r = await this.db.query<UpgradeRequestRow>(
      `SELECT * FROM upgrade_requests WHERE id = $1`,
      [id],
    );
    return r.rows[0];
  }

  async findActiveByVmId(vmId: string): Promise<UpgradeRequestRow | undefined> {
    const r = await this.db.query<UpgradeRequestRow>(
      `SELECT * FROM upgrade_requests
       WHERE vm_id = $1 AND status IN ('PENDING_APPROVAL', 'APPROVED', 'RESIZING')
       LIMIT 1`,
      [vmId],
    );
    return r.rows[0];
  }

  async listByCustomer(customerId: string): Promise<UpgradeRequestRow[]> {
    const r = await this.db.query<UpgradeRequestRow>(
      `SELECT * FROM upgrade_requests WHERE customer_id = $1 ORDER BY created_at DESC`,
      [customerId],
    );
    return r.rows;
  }

  async listByVm(vmId: string): Promise<UpgradeRequestRow[]> {
    const r = await this.db.query<UpgradeRequestRow>(
      `SELECT * FROM upgrade_requests WHERE vm_id = $1 ORDER BY created_at DESC`,
      [vmId],
    );
    return r.rows;
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
    const vals: unknown[] = [id, status];
    let idx = 3;

    if ("provider_approved_at" in fields) {
      sets.push(`provider_approved_at = $${idx++}`);
      vals.push(fields.provider_approved_at);
    }
    if ("approved_by" in fields) {
      sets.push(`approved_by = $${idx++}`);
      vals.push(fields.approved_by);
    }
    if ("customer_confirmed_at" in fields) {
      sets.push(`customer_confirmed_at = $${idx++}`);
      vals.push(fields.customer_confirmed_at);
    }
    if ("rejection_reason" in fields) {
      sets.push(`rejection_reason = $${idx++}`);
      vals.push(fields.rejection_reason);
    }
    if ("last_error" in fields) {
      sets.push(`last_error = $${idx++}`);
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
    return r.rows[0]!;
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
