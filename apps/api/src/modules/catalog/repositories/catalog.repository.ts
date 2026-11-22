import { Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../database/database.service.js";

export interface TemplateRow {
  id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  slug: string;
  description: string | null;
  cpu_cores: number;
  ram_gb: number;
  storage_gb: number;
  storage_type: string;
  operating_system: string;
  bandwidth_mbps: number;
  region: string;
  availability: "available" | "limited" | "unavailable" | "retired";
  active: boolean;
  current_pricing_version_id: string | null;
  capacity_pool_id: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  pricing_version_id?: string | null;
  currency?: string | null;
  hourly_rate?: string | null;
  daily_rate?: string | null;
  monthly_rate?: string | null;
  minimum_price?: string | null;
}

export interface CapacityPoolRow {
  id: string;
  organization_id: string;
  name: string;
  region: string;
  total_cpu_cores: number;
  total_ram_gb: number;
  total_storage_gb: number;
  available: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CapacityUsageRow {
  cpu_used: string;
  ram_used: string;
  storage_used: string;
  held_count: string;
  committed_count: string;
}

const templateColumns = `t.id, t.organization_id, o.name AS organization_name, t.name, t.slug,
  t.description, t.cpu_cores, t.ram_gb, t.storage_gb, t.storage_type,
  t.operating_system, t.bandwidth_mbps, t.region, t.availability, t.active,
  t.current_pricing_version_id, t.capacity_pool_id, t.created_by, t.created_at, t.updated_at`;

@Injectable()
export class CatalogRepository {
  constructor(private readonly db: DatabaseService) {}

  async listCustomerTemplates(filters: Record<string, unknown>): Promise<{ rows: TemplateRow[]; total: number }> {
    const values: unknown[] = [];
    const where = ["o.status = 'active'", "t.active = true", "t.availability <> 'retired'"];
    this.addFilter(where, values, "t.region", filters.region);
    this.addFilter(where, values, "t.operating_system", filters.operatingSystem);
    this.addFilter(where, values, "t.storage_type", filters.storageType);
    this.addFilter(where, values, "t.availability", filters.availability);
    if (filters.includeUnavailable !== true && filters.availability === undefined) {
      where.push("t.availability IN ('available', 'limited')");
    }
    this.addNumericFilter(where, values, "t.cpu_cores", filters.minCpuCores);
    this.addNumericFilter(where, values, "t.ram_gb", filters.minRamGb);
    this.addNumericFilter(where, values, "t.storage_gb", filters.minStorageGb);
    const count = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM vm_templates t JOIN organizations o ON o.id = t.organization_id WHERE ${where.join(" AND ")}`,
      values,
    );
    const page = Number(filters.page ?? 1);
    const pageSize = Number(filters.pageSize ?? 25);
    const offset = (page - 1) * pageSize;
    const result = await this.db.query<TemplateRow>(
      `SELECT ${templateColumns}, pv.id AS pricing_version_id, pv.currency,
              pr.hourly_rate, pr.daily_rate, pr.monthly_rate, pr.minimum_price
       FROM vm_templates t
       JOIN organizations o ON o.id = t.organization_id
       LEFT JOIN LATERAL (
         SELECT id, currency FROM pricing_versions
         WHERE organization_id = t.organization_id AND status = 'active'
           AND effective_from <= NOW() AND (effective_to IS NULL OR effective_to > NOW())
         ORDER BY effective_from DESC, created_at DESC, id DESC LIMIT 1
       ) pv ON true
       LEFT JOIN pricing_rules pr ON pr.pricing_version_id = pv.id
         AND pr.vm_template_id = t.id AND pr.rule_type = 'template_base'
       WHERE ${where.join(" AND ")}
       ORDER BY t.name ASC, t.id ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, offset],
    );
    return { rows: result.rows, total: Number(count.rows[0]?.count ?? 0) };
  }

  async findCustomerTemplate(id: string): Promise<TemplateRow | undefined> {
    const result = await this.db.query<TemplateRow>(
      `SELECT ${templateColumns}, pv.id AS pricing_version_id, pv.currency,
              pr.hourly_rate, pr.daily_rate, pr.monthly_rate, pr.minimum_price
       FROM vm_templates t
       JOIN organizations o ON o.id = t.organization_id
       LEFT JOIN LATERAL (
         SELECT id, currency FROM pricing_versions
         WHERE organization_id = t.organization_id AND status = 'active'
           AND effective_from <= NOW() AND (effective_to IS NULL OR effective_to > NOW())
         ORDER BY effective_from DESC, created_at DESC, id DESC LIMIT 1
       ) pv ON true
       LEFT JOIN pricing_rules pr ON pr.pricing_version_id = pv.id
         AND pr.vm_template_id = t.id AND pr.rule_type = 'template_base'
       WHERE t.id = $1 AND o.status = 'active' AND t.active = true AND t.availability <> 'retired'`,
      [id],
    );
    return result.rows[0];
  }

  async listProviderTemplates(organizationId: string, page: number, pageSize: number): Promise<{ rows: TemplateRow[]; total: number }> {
    const count = await this.db.query<{ count: string }>("SELECT count(*)::text AS count FROM vm_templates WHERE organization_id = $1", [organizationId]);
    const result = await this.db.query<TemplateRow>(
      `SELECT ${templateColumns} FROM vm_templates t JOIN organizations o ON o.id = t.organization_id
       WHERE t.organization_id = $1 ORDER BY t.created_at DESC, t.id DESC LIMIT $2 OFFSET $3`,
      [organizationId, pageSize, (page - 1) * pageSize],
    );
    return { rows: result.rows, total: Number(count.rows[0]?.count ?? 0) };
  }

  async findProviderTemplate(id: string, organizationId: string, client?: PoolClient): Promise<TemplateRow | undefined> {
    const executor = (client ?? this.db) as unknown as { query<T extends QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> };
    const result = await executor.query<TemplateRow>(
      `SELECT ${templateColumns} FROM vm_templates t JOIN organizations o ON o.id = t.organization_id
       WHERE t.id = $1 AND t.organization_id = $2${client ? " FOR UPDATE" : ""}`,
      [id, organizationId],
    );
    return result.rows[0];
  }

  async createTemplate(input: Record<string, unknown>): Promise<TemplateRow> {
    return this.db.transaction(async (client) => {
      await this.assertAssociations(client, input.organizationId as string, input.capacityPoolId as string | undefined, input.pricingVersionId as string | undefined, input.region as string | undefined);
      const result = await client.query<TemplateRow>(
        `INSERT INTO vm_templates
         (organization_id, name, slug, description, cpu_cores, ram_gb, storage_gb, storage_type,
          operating_system, bandwidth_mbps, region, availability, active, current_pricing_version_id,
          created_by, capacity_pool_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,'available'),COALESCE($13,true),$14,$15,$16)
         RETURNING id, organization_id, name, slug, description, cpu_cores, ram_gb, storage_gb,
                   storage_type, operating_system, bandwidth_mbps, region, availability, active,
                   current_pricing_version_id, capacity_pool_id, created_by, created_at, updated_at`,
        [input.organizationId, input.name, input.slug, input.description ?? null, input.cpuCores, input.ramGb, input.storageGb,
          input.storageType, input.operatingSystem, input.bandwidthMbps, input.region, input.availability ?? null,
          input.active ?? null, input.pricingVersionId ?? null, input.createdBy, input.capacityPoolId ?? null],
      );
      await client.query(
        `INSERT INTO audit_logs (actor_id, organization_id, action, entity_type, entity_id, new_data)
         VALUES ($1,$2,'catalog.template_created','vm_template',$3,$4::jsonb)`,
        [input.createdBy, input.organizationId, result.rows[0].id, JSON.stringify(result.rows[0])],
      );
      return result.rows[0];
    });
  }

  async updateTemplate(id: string, organizationId: string, input: Record<string, unknown>, actorId: string): Promise<TemplateRow | undefined> {
    return this.db.transaction(async (client) => {
      const current = await this.findProviderTemplate(id, organizationId, client);
      if (!current) return undefined;
      await this.assertAssociations(client, organizationId, (input.capacityPoolId ?? current.capacity_pool_id) as string | undefined, input.pricingVersionId as string | undefined ?? current.current_pricing_version_id ?? undefined, (input.region ?? current.region) as string | undefined);
      const entries: Array<[string, unknown]> = [
        ["name", input.name], ["description", input.description], ["cpu_cores", input.cpuCores], ["ram_gb", input.ramGb],
        ["storage_gb", input.storageGb], ["storage_type", input.storageType], ["operating_system", input.operatingSystem],
        ["bandwidth_mbps", input.bandwidthMbps], ["region", input.region], ["availability", input.availability], ["active", input.active],
        ["current_pricing_version_id", input.pricingVersionId], ["capacity_pool_id", input.capacityPoolId],
      ];
      const assignments: string[] = ["updated_at = NOW()"]; const values: unknown[] = [id, organizationId];
      for (const [column, value] of entries) if (value !== undefined) { assignments.push(`${column} = $${values.length + 1}`); values.push(value); }
      const result = await client.query<TemplateRow>(
        `UPDATE vm_templates SET ${assignments.join(", ")} WHERE id = $1 AND organization_id = $2
         RETURNING id, organization_id, name, slug, description, cpu_cores, ram_gb, storage_gb,
                   storage_type, operating_system, bandwidth_mbps, region, availability, active,
                   current_pricing_version_id, capacity_pool_id, created_by, created_at, updated_at`,
        values,
      );
      await this.insertAudit(client, actorId, organizationId, "catalog.template_updated", "vm_template", id, current, result.rows[0]);
      return result.rows[0];
    });
  }

  async setTemplateState(id: string, organizationId: string, state: { active?: boolean; availability?: string }, actorId: string): Promise<TemplateRow | undefined> {
    return this.updateTemplate(id, organizationId, state, actorId);
  }

  async listPools(organizationId: string, page: number, pageSize: number): Promise<{ rows: CapacityPoolRow[]; total: number }> {
    const count = await this.db.query<{ count: string }>("SELECT count(*)::text AS count FROM capacity_pools WHERE organization_id = $1", [organizationId]);
    const result = await this.db.query<CapacityPoolRow>(
      `SELECT id, organization_id, name, region, total_cpu_cores, total_ram_gb, total_storage_gb,
              available, created_by, created_at, updated_at
       FROM capacity_pools WHERE organization_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
      [organizationId, pageSize, (page - 1) * pageSize],
    );
    return { rows: result.rows, total: Number(count.rows[0]?.count ?? 0) };
  }

  async findPool(id: string, organizationId: string, client?: PoolClient): Promise<CapacityPoolRow | undefined> {
    const executor = (client ?? this.db) as unknown as { query<T extends QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> };
    const result = await executor.query<CapacityPoolRow>(
      `SELECT id, organization_id, name, region, total_cpu_cores, total_ram_gb, total_storage_gb,
              available, created_by, created_at, updated_at
       FROM capacity_pools WHERE id = $1 AND organization_id = $2${client ? " FOR UPDATE" : ""}`,
      [id, organizationId],
    );
    return result.rows[0];
  }

  async createPool(input: Record<string, unknown>): Promise<CapacityPoolRow> {
    return this.db.transaction(async (client) => {
    const result = await client.query<CapacityPoolRow>(
      `INSERT INTO capacity_pools (organization_id, name, region, total_cpu_cores, total_ram_gb, total_storage_gb, available, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,true),$8)
       RETURNING id, organization_id, name, region, total_cpu_cores, total_ram_gb, total_storage_gb, available, created_by, created_at, updated_at`,
      [input.organizationId, input.name, input.region, input.totalCpuCores, input.totalRamGb, input.totalStorageGb, input.available ?? null, input.createdBy],
    );
    await client.query(
      `INSERT INTO audit_logs (actor_id, organization_id, action, entity_type, entity_id, new_data)
       VALUES ($1,$2,'catalog.capacity_pool_created','capacity_pool',$3,$4::jsonb)`,
      [input.createdBy, input.organizationId, result.rows[0].id, JSON.stringify(result.rows[0])],
    );
    return result.rows[0];
    });
  }

  async updatePool(id: string, organizationId: string, input: Record<string, unknown>, actorId: string): Promise<CapacityPoolRow | undefined> {
    return this.db.transaction(async (client) => {
      const current = await this.findPool(id, organizationId, client);
      if (!current) return undefined;
      const usage = await this.capacityUsage(id, client);
      const next = {
        cpu: Number(input.totalCpuCores ?? current.total_cpu_cores),
        ram: Number(input.totalRamGb ?? current.total_ram_gb),
        storage: Number(input.totalStorageGb ?? current.total_storage_gb),
      };
      if (input.region !== undefined && input.region !== current.region) {
        const attached = await client.query("SELECT 1 FROM vm_templates WHERE capacity_pool_id = $1 AND region <> $2 LIMIT 1", [id, input.region]);
        if (attached.rowCount) throw new Error("CAPACITY_REGION_IN_USE");
      }
      if (next.cpu < Number(usage.cpu_used) || next.ram < Number(usage.ram_used) || next.storage < Number(usage.storage_used)) {
        throw new Error("CAPACITY_SHRINK_BELOW_ALLOCATIONS");
      }
      const entries: Array<[string, unknown]> = [["name", input.name], ["region", input.region], ["total_cpu_cores", input.totalCpuCores], ["total_ram_gb", input.totalRamGb], ["total_storage_gb", input.totalStorageGb], ["available", input.available]];
      const assignments: string[] = ["updated_at = NOW()"]; const values: unknown[] = [id, organizationId];
      for (const [column, value] of entries) if (value !== undefined) { assignments.push(`${column} = $${values.length + 1}`); values.push(value); }
      const result = await client.query<CapacityPoolRow>(
        `UPDATE capacity_pools SET ${assignments.join(", ")} WHERE id = $1 AND organization_id = $2
         RETURNING id, organization_id, name, region, total_cpu_cores, total_ram_gb, total_storage_gb, available, created_by, created_at, updated_at`, values,
      );
      await this.insertAudit(client, actorId, organizationId, "catalog.capacity_pool_updated", "capacity_pool", id, current, result.rows[0]);
      return result.rows[0];
    });
  }

  async capacityUsage(poolId: string, client?: PoolClient): Promise<CapacityUsageRow> {
    const executor = (client ?? this.db) as unknown as { query<T extends QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> };
    const result = await executor.query<CapacityUsageRow>(
      `SELECT COALESCE(SUM(cpu_cores) FILTER (WHERE status = 'committed' OR (status = 'held' AND expires_at > NOW())), 0)::text AS cpu_used,
              COALESCE(SUM(ram_gb) FILTER (WHERE status = 'committed' OR (status = 'held' AND expires_at > NOW())), 0)::text AS ram_used,
              COALESCE(SUM(storage_gb) FILTER (WHERE status = 'committed' OR (status = 'held' AND expires_at > NOW())), 0)::text AS storage_used,
              count(*) FILTER (WHERE status = 'held' AND expires_at > NOW())::text AS held_count,
              count(*) FILTER (WHERE status = 'committed')::text AS committed_count
       FROM capacity_reservations WHERE pool_id = $1`, [poolId],
    );
    return result.rows[0];
  }

  async poolsForAvailability(organizationId: string, region: string): Promise<Array<CapacityPoolRow & CapacityUsageRow>> {
    const result = await this.db.query<CapacityPoolRow & CapacityUsageRow>(
      `SELECT p.id, p.organization_id, p.name, p.region, p.total_cpu_cores, p.total_ram_gb, p.total_storage_gb,
              p.available, p.created_by, p.created_at, p.updated_at,
              COALESCE(SUM(r.cpu_cores) FILTER (WHERE r.status = 'committed' OR (r.status = 'held' AND r.expires_at > NOW())), 0)::text AS cpu_used,
              COALESCE(SUM(r.ram_gb) FILTER (WHERE r.status = 'committed' OR (r.status = 'held' AND r.expires_at > NOW())), 0)::text AS ram_used,
              COALESCE(SUM(r.storage_gb) FILTER (WHERE r.status = 'committed' OR (r.status = 'held' AND r.expires_at > NOW())), 0)::text AS storage_used,
              count(r.id) FILTER (WHERE r.status = 'held' AND r.expires_at > NOW())::text AS held_count,
              count(r.id) FILTER (WHERE r.status = 'committed')::text AS committed_count
       FROM capacity_pools p LEFT JOIN capacity_reservations r ON r.pool_id = p.id
       WHERE p.organization_id = $1 AND p.region = $2 AND p.available = true
       GROUP BY p.id ORDER BY p.id`, [organizationId, region],
    );
    return result.rows;
  }

  private addFilter(where: string[], values: unknown[], column: string, value: unknown): void {
    if (value !== undefined) { values.push(value); where.push(`${column} = $${values.length}`); }
  }

  private addNumericFilter(where: string[], values: unknown[], column: string, value: unknown): void {
    if (value !== undefined) { values.push(value); where.push(`${column} >= $${values.length}`); }
  }

  private async assertAssociations(client: PoolClient, organizationId: string, poolId?: string, pricingVersionId?: string, region?: string): Promise<void> {
    if (poolId) {
      const pool = await client.query("SELECT 1 FROM capacity_pools WHERE id = $1 AND organization_id = $2 AND ($3::text IS NULL OR region = $3)", [poolId, organizationId, region ?? null]);
      if (!pool.rowCount) throw new Error("CROSS_ORGANIZATION_CAPACITY_POOL");
    }
    if (pricingVersionId) {
      const version = await client.query("SELECT 1 FROM pricing_versions WHERE id = $1 AND organization_id = $2 AND status = 'active'", [pricingVersionId, organizationId]);
      if (!version.rowCount) throw new Error("CROSS_ORGANIZATION_PRICING_VERSION");
    }
  }

  private async insertAudit(client: PoolClient, actorId: string, organizationId: string, action: string, entityType: string, entityId: string, oldData: unknown, newData: unknown): Promise<void> {
    await client.query(
      `INSERT INTO audit_logs (actor_id, organization_id, action, entity_type, entity_id, old_data, new_data)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [actorId, organizationId, action, entityType, entityId, JSON.stringify(oldData), JSON.stringify(newData)],
    );
  }
}
