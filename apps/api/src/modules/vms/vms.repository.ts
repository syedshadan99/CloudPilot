import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import type { VmState } from "./vm-state-machine.js";

export interface VmRow {
  id: string;
  customer_id: string;
  provisioning_job_id: string | null;
  state: VmState;
  simulated_vm_id: string | null;
  hostname: string | null;
  ip_address: string | null;
  vm_config: Record<string, unknown>;
  name: string | null;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  stopped_at: Date | null;
  terminated_at: Date | null;
}

export interface VmEventRow {
  id: string;
  vm_id: string;
  actor_id: string;
  from_state: string;
  to_state: string;
  action: string;
  note: string | null;
  created_at: Date;
}

@Injectable()
export class VmsRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(params: {
    customerId: string;
    provisioningJobId: string;
    simulatedVmId: string;
    hostname: string;
    ipAddress: string;
    vmConfig: Record<string, unknown>;
    name?: string;
  }): Promise<VmRow> {
    const r = await this.db.query<VmRow>(
      `INSERT INTO virtual_machines
         (customer_id, provisioning_job_id, state, simulated_vm_id, hostname,
          ip_address, vm_config, name, started_at)
       VALUES ($1,$2,'RUNNING',$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (simulated_vm_id) DO UPDATE
         SET updated_at = virtual_machines.updated_at
       RETURNING *`,
      [
        params.customerId,
        params.provisioningJobId,
        params.simulatedVmId,
        params.hostname,
        params.ipAddress,
        JSON.stringify(params.vmConfig),
        params.name ?? null,
      ],
    );
    return r.rows[0]!;
  }

  async findById(id: string): Promise<VmRow | undefined> {
    const r = await this.db.query<VmRow>(
      `SELECT * FROM virtual_machines WHERE id = $1`,
      [id],
    );
    return r.rows[0];
  }

  async listByCustomer(customerId: string): Promise<VmRow[]> {
    const r = await this.db.query<VmRow>(
      `SELECT * FROM virtual_machines WHERE customer_id = $1 ORDER BY created_at DESC`,
      [customerId],
    );
    return r.rows;
  }

  async updateState(
    id: string,
    state: VmState,
    timestamps: Partial<Pick<VmRow, "started_at" | "stopped_at" | "terminated_at">> = {},
  ): Promise<VmRow> {
    const sets = ["state = $2", "updated_at = NOW()"];
    const vals: unknown[] = [id, state];
    let i = 3;

    if ("started_at" in timestamps)    { sets.push(`started_at = $${i++}`);    vals.push(timestamps.started_at ?? null); }
    if ("stopped_at" in timestamps)    { sets.push(`stopped_at = $${i++}`);    vals.push(timestamps.stopped_at ?? null); }
    if ("terminated_at" in timestamps) { sets.push(`terminated_at = $${i++}`); vals.push(timestamps.terminated_at ?? null); }

    const r = await this.db.query<VmRow>(
      `UPDATE virtual_machines SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
      vals,
    );
    return r.rows[0]!;
  }

  async recordEvent(params: {
    vmId: string;
    actorId: string;
    fromState: string;
    toState: string;
    action: string;
    note?: string;
  }): Promise<VmEventRow> {
    const r = await this.db.query<VmEventRow>(
      `INSERT INTO vm_state_events (vm_id, actor_id, from_state, to_state, action, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [params.vmId, params.actorId, params.fromState, params.toState, params.action, params.note ?? null],
    );
    return r.rows[0]!;
  }

  async listEvents(vmId: string): Promise<VmEventRow[]> {
    const r = await this.db.query<VmEventRow>(
      `SELECT * FROM vm_state_events WHERE vm_id = $1 ORDER BY created_at ASC`,
      [vmId],
    );
    return r.rows;
  }
}
