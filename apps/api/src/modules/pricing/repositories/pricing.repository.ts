import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../database/database.service.js";
import { AuditService } from "../../../common/audit/audit.service.js";

export interface PricingVersionRow {
  id: string; organization_id: string; version_name: string; currency: string; effective_from: Date; effective_to: Date | null;
  status: "draft" | "active" | "retired"; created_by: string; created_at: Date;
}
export interface PricingRuleRow {
  id: string; pricing_version_id: string; vm_template_id: string | null; rule_type: string;
  hourly_rate: string | null; daily_rate: string | null; monthly_rate: string | null; unit_price: string | null;
  minimum_price: string | null; maximum_discount_percent: string | null; metadata: Record<string, unknown>; created_at: Date;
}
export interface PolicyRow {
  id: string; organization_id: string; name: string; maximum_discount_percent: string; minimum_price: string;
  approval_threshold: string; maximum_attempts: number; effective_from: Date; effective_to: Date | null;
  active: boolean; created_by: string; created_at: Date;
}

export interface QuoteTemplate {
  id: string; organization_id: string; organization_name: string; name: string; slug: string; description: string | null;
  cpu_cores: number; ram_gb: number; storage_gb: number; storage_type: string; operating_system: string;
  bandwidth_mbps: number; region: string; availability: string; active: boolean; capacity_pool_id: string | null;
}
export interface QuotePool {
  id: string; total_cpu_cores: number; total_ram_gb: number; total_storage_gb: number;
  cpu_used: string; ram_used: string; storage_used: string;
}

@Injectable()
export class PricingRepository {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService) {}

  async listVersions(organizationId: string, page: number, pageSize: number, includeRules: boolean) {
    const count = await this.db.query<{ count: string }>("SELECT count(*)::text AS count FROM pricing_versions WHERE organization_id = $1", [organizationId]);
    const versions = await this.db.query<PricingVersionRow>(
      `SELECT id, organization_id, version_name, currency, effective_from, effective_to, status, created_by, created_at
       FROM pricing_versions WHERE organization_id = $1 ORDER BY effective_from DESC, created_at DESC, id DESC LIMIT $2 OFFSET $3`,
      [organizationId, pageSize, (page - 1) * pageSize],
    );
    const data = [];
    for (const version of versions.rows) data.push({ version, rules: includeRules ? await this.listRules(version.id) : undefined });
    return { data, total: Number(count.rows[0]?.count ?? 0) };
  }

  async findVersion(id: string, organizationId: string, client?: PoolClient): Promise<{ version: PricingVersionRow; rules: PricingRuleRow[] } | undefined> {
    const executor = (client ?? this.db) as unknown as { query<T extends QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> };
    const version = await executor.query<PricingVersionRow>(
      `SELECT id, organization_id, version_name, currency, effective_from, effective_to, status, created_by, created_at
       FROM pricing_versions WHERE id = $1 AND organization_id = $2${client ? " FOR UPDATE" : ""}`, [id, organizationId],
    );
    if (!version.rows[0]) return undefined;
    const rules = await executor.query<PricingRuleRow>(
      `SELECT id, pricing_version_id, vm_template_id, rule_type, hourly_rate, daily_rate, monthly_rate, unit_price,
              minimum_price, maximum_discount_percent, metadata, created_at
       FROM pricing_rules WHERE pricing_version_id = $1 ORDER BY rule_type, vm_template_id NULLS FIRST, id`, [id],
    );
    return { version: version.rows[0], rules: rules.rows };
  }

  async listRules(versionId: string): Promise<PricingRuleRow[]> {
    const result = await this.db.query<PricingRuleRow>(
      `SELECT id, pricing_version_id, vm_template_id, rule_type, hourly_rate, daily_rate, monthly_rate, unit_price,
              minimum_price, maximum_discount_percent, metadata, created_at
       FROM pricing_rules WHERE pricing_version_id = $1 ORDER BY rule_type, vm_template_id NULLS FIRST, id`, [versionId],
    );
    return result.rows;
  }

  async createVersion(input: Record<string, unknown>): Promise<PricingVersionRow> {
    return this.db.transaction(async (client) => {
      const result = await client.query<PricingVersionRow>(
        `INSERT INTO pricing_versions (organization_id, version_name, currency, effective_from, effective_to, status, created_by)
         VALUES ($1,$2,$3,$4,$5,'draft',$6)
         RETURNING id, organization_id, version_name, currency, effective_from, effective_to, status, created_by, created_at`,
        [input.organizationId, input.versionName, input.currency, input.effectiveFrom, input.effectiveTo ?? null, input.createdBy],
      );
      await this.audit.record({ actorId: input.createdBy as string, organizationId: input.organizationId as string, action: "pricing.version_created", entityType: "pricing_version", entityId: result.rows[0].id, newData: result.rows[0] }, client);
      return result.rows[0];
    });
  }

  async updateVersion(id: string, organizationId: string, input: Record<string, unknown>, actorId: string): Promise<PricingVersionRow | undefined> {
    return this.db.transaction(async (client) => {
      const current = await this.findVersion(id, organizationId, client);
      if (!current) return undefined;
      if (current.version.status !== "draft") throw new ConflictException("Only draft pricing versions can be edited");
      const fields: Array<[string, unknown]> = [["version_name", input.versionName], ["currency", input.currency], ["effective_from", input.effectiveFrom], ["effective_to", input.effectiveTo]];
      const assignments: string[] = []; const values: unknown[] = [id, organizationId];
      for (const [column, value] of fields) if (value !== undefined) { assignments.push(`${column} = $${values.length + 1}`); values.push(value); }
      if (!assignments.length) return current.version;
      const result = await client.query<PricingVersionRow>(`UPDATE pricing_versions SET ${assignments.join(", ")} WHERE id = $1 AND organization_id = $2 AND status = 'draft' RETURNING id, organization_id, version_name, currency, effective_from, effective_to, status, created_by, created_at`, values);
      await this.audit.record({ actorId, organizationId, action: "pricing.version_updated", entityType: "pricing_version", entityId: id, oldData: current.version, newData: result.rows[0] }, client);
      return result.rows[0];
    });
  }

  async createRule(versionId: string, organizationId: string, input: Record<string, unknown>, actorId: string): Promise<PricingRuleRow> {
    return this.db.transaction(async (client) => {
      const version = await this.findVersion(versionId, organizationId, client);
      if (!version) throw new NotFoundException("Pricing version not found");
      if (version.version.status !== "draft") throw new ConflictException("Only draft pricing versions can be edited");
      await this.assertTemplateOwnership(client, input.vmTemplateId as string | undefined, organizationId);
      const result = await client.query<PricingRuleRow>(
        `INSERT INTO pricing_rules (pricing_version_id, vm_template_id, rule_type, hourly_rate, daily_rate, monthly_rate, unit_price, minimum_price, maximum_discount_percent, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
         RETURNING id, pricing_version_id, vm_template_id, rule_type, hourly_rate, daily_rate, monthly_rate, unit_price, minimum_price, maximum_discount_percent, metadata, created_at`,
        [versionId, input.vmTemplateId ?? null, input.ruleType, input.hourlyRate ?? null, input.dailyRate ?? null, input.monthlyRate ?? null, input.unitPrice ?? null, input.minimumPrice ?? null, input.maximumDiscountPercent ?? null, JSON.stringify(input.metadata ?? {})],
      );
      await this.audit.record({ actorId, organizationId, action: "pricing.rule_created", entityType: "pricing_rule", entityId: result.rows[0].id, newData: result.rows[0] }, client);
      return result.rows[0];
    });
  }

  async updateRule(ruleId: string, versionId: string, organizationId: string, input: Record<string, unknown>, actorId: string): Promise<PricingRuleRow | undefined> {
    return this.db.transaction(async (client) => {
      const version = await this.findVersion(versionId, organizationId, client);
      if (!version) throw new NotFoundException("Pricing version not found");
      if (version.version.status !== "draft") throw new ConflictException("Only draft pricing versions can be edited");
      const current = version.rules.find((rule) => rule.id === ruleId);
      if (!current) return undefined;
      const fields: Array<[string, unknown]> = [["hourly_rate", input.hourlyRate], ["daily_rate", input.dailyRate], ["monthly_rate", input.monthlyRate], ["unit_price", input.unitPrice], ["minimum_price", input.minimumPrice], ["maximum_discount_percent", input.maximumDiscountPercent], ["metadata", input.metadata === undefined ? undefined : JSON.stringify(input.metadata)]];
      const assignments: string[] = []; const values: unknown[] = [ruleId, versionId];
      for (const [column, value] of fields) if (value !== undefined) { assignments.push(`${column} = $${values.length + 1}${column === "metadata" ? "::jsonb" : ""}`); values.push(value); }
      if (!assignments.length) return current;
      const result = await client.query<PricingRuleRow>(`UPDATE pricing_rules SET ${assignments.join(", ")} WHERE id = $1 AND pricing_version_id = $2 RETURNING id, pricing_version_id, vm_template_id, rule_type, hourly_rate, daily_rate, monthly_rate, unit_price, minimum_price, maximum_discount_percent, metadata, created_at`, values);
      await this.audit.record({ actorId, organizationId, action: "pricing.rule_updated", entityType: "pricing_rule", entityId: ruleId, oldData: current, newData: result.rows[0] }, client);
      return result.rows[0];
    });
  }

  async deleteRule(ruleId: string, versionId: string, organizationId: string, actorId: string): Promise<void> {
    await this.db.transaction(async (client) => {
      const version = await this.findVersion(versionId, organizationId, client);
      if (!version) throw new NotFoundException("Pricing version not found");
      if (version.version.status !== "draft") throw new ConflictException("Historical pricing rules cannot be deleted");
      const current = version.rules.find((rule) => rule.id === ruleId);
      if (!current) throw new NotFoundException("Pricing rule not found");
      await client.query("DELETE FROM pricing_rules WHERE id = $1 AND pricing_version_id = $2", [ruleId, versionId]);
      await this.audit.record({ actorId, organizationId, action: "pricing.rule_deleted", entityType: "pricing_rule", entityId: ruleId, oldData: current }, client);
    });
  }

  async activateVersion(id: string, organizationId: string, actorId: string): Promise<PricingVersionRow> {
    return this.db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`pricing:${organizationId}`]);
      const current = await this.findVersion(id, organizationId, client);
      if (!current) throw new NotFoundException("Pricing version not found");
      if (current.version.status !== "draft") throw new ConflictException("Only draft pricing versions can be activated");
      const sameEffective = await client.query("SELECT 1 FROM pricing_versions WHERE organization_id = $1 AND status = 'active' AND effective_from = $2 AND id <> $3", [organizationId, current.version.effective_from, id]);
      if (sameEffective.rowCount) throw new ConflictException("Pricing version effective dates are ambiguous");
      const completeness = await client.query<{ missing_template_id: string }>(
        `SELECT t.id AS missing_template_id FROM vm_templates t
         LEFT JOIN pricing_rules r ON r.pricing_version_id = $1 AND r.vm_template_id = t.id AND r.rule_type = 'template_base'
         WHERE t.organization_id = $2 AND t.active = true AND t.availability IN ('available', 'limited') AND r.id IS NULL LIMIT 1`, [id, organizationId],
      );
      if (completeness.rows[0]) throw new ConflictException("Pricing version needs a template_base rule for every active non-retired template");
      const future = await client.query<{ effective_from: Date }>(
        `SELECT effective_from FROM pricing_versions WHERE organization_id = $1 AND status = 'active' AND effective_from > $2 ORDER BY effective_from ASC LIMIT 1 FOR UPDATE`, [organizationId, current.version.effective_from],
      );
      const futureEffective = future.rows[0]?.effective_from ?? null;
      if (futureEffective && futureEffective <= current.version.effective_from) throw new ConflictException("Pricing version effective dates are ambiguous");
      await client.query(
        `UPDATE pricing_versions SET effective_to = $2 WHERE organization_id = $1 AND status = 'active' AND effective_from < $2 AND (effective_to IS NULL OR effective_to > $2)`,
        [organizationId, current.version.effective_from],
      );
      const activated = await client.query<PricingVersionRow>(
        `UPDATE pricing_versions SET status = 'active', effective_to = $2 WHERE id = $1 AND organization_id = $3
         RETURNING id, organization_id, version_name, currency, effective_from, effective_to, status, created_by, created_at`,
        [id, futureEffective, organizationId],
      );
      await client.query(`UPDATE vm_templates SET current_pricing_version_id = $1, updated_at = NOW() WHERE organization_id = $2 AND active = true AND availability <> 'retired' AND $3 <= NOW()`, [id, organizationId, current.version.effective_from]);
      await this.audit.record({ actorId, organizationId, action: "pricing.version_activated", entityType: "pricing_version", entityId: id, newData: activated.rows[0] }, client);
      return activated.rows[0];
    });
  }

  async retireVersion(id: string, organizationId: string, actorId: string): Promise<PricingVersionRow> {
    return this.db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`pricing:${organizationId}`]);
      const current = await this.findVersion(id, organizationId, client);
      if (!current) throw new NotFoundException("Pricing version not found");
      if (current.version.status === "retired") return current.version;
      const result = await client.query<PricingVersionRow>(`UPDATE pricing_versions SET status = 'retired' WHERE id = $1 AND organization_id = $2 RETURNING id, organization_id, version_name, currency, effective_from, effective_to, status, created_by, created_at`, [id, organizationId]);
      await this.audit.record({ actorId, organizationId, action: "pricing.version_retired", entityType: "pricing_version", entityId: id, oldData: current.version, newData: result.rows[0] }, client);
      return result.rows[0];
    });
  }

  async loadQuoteContext(templateId: string | undefined, organizationId: string | undefined, region: string | undefined, transactionClient?: PoolClient) {
    const load = async (client: PoolClient) => {
      let template: QuoteTemplate | null = null;
      let resolvedOrganizationId = organizationId;
      if (templateId) {
        const result = await client.query<QuoteTemplate>(
          `SELECT t.id, t.organization_id, o.name AS organization_name, t.name, t.slug, t.description, t.cpu_cores, t.ram_gb, t.storage_gb,
                  t.storage_type, t.operating_system, t.bandwidth_mbps, t.region, t.availability, t.active, t.capacity_pool_id
           FROM vm_templates t JOIN organizations o ON o.id = t.organization_id
           WHERE t.id = $1 AND o.status = 'active'`, [templateId],
        );
        template = result.rows[0] ?? null;
        if (!template) throw new NotFoundException("VM template not found");
        resolvedOrganizationId = template.organization_id;
        if (!template.active || template.availability === "retired" || template.availability === "unavailable") throw new ConflictException("This VM template is not eligible for new quotations");
      }
      if (!resolvedOrganizationId) throw new ConflictException("An organization is required for a custom configuration");
      const quoteRegion = region ?? template?.region;
      if (!quoteRegion) throw new ConflictException("A region is required for a custom configuration");
      if (template && quoteRegion !== template.region) throw new ConflictException("The requested region does not match the selected template");
      const versionResult = await client.query<PricingVersionRow>(
        `SELECT id, organization_id, version_name, currency, effective_from, effective_to, status, created_by, created_at
         FROM pricing_versions WHERE organization_id = $1 AND status = 'active' AND effective_from <= NOW() AND (effective_to IS NULL OR effective_to > NOW())
         ORDER BY effective_from DESC, created_at DESC, id DESC LIMIT 1 FOR SHARE`, [resolvedOrganizationId],
      );
      const version = versionResult.rows[0];
      if (!version) throw new ConflictException("No active pricing version is effective for this provider");
      const rules = await client.query<PricingRuleRow>(`SELECT id, pricing_version_id, vm_template_id, rule_type, hourly_rate, daily_rate, monthly_rate, unit_price, minimum_price, maximum_discount_percent, metadata, created_at FROM pricing_rules WHERE pricing_version_id = $1`, [version.id]);
      const pools = await client.query<QuotePool>(
        `SELECT p.id, p.total_cpu_cores, p.total_ram_gb, p.total_storage_gb,
                COALESCE(SUM(r.cpu_cores) FILTER (WHERE r.status = 'committed' OR (r.status = 'held' AND r.expires_at > NOW())), 0)::text AS cpu_used,
                COALESCE(SUM(r.ram_gb) FILTER (WHERE r.status = 'committed' OR (r.status = 'held' AND r.expires_at > NOW())), 0)::text AS ram_used,
                COALESCE(SUM(r.storage_gb) FILTER (WHERE r.status = 'committed' OR (r.status = 'held' AND r.expires_at > NOW())), 0)::text AS storage_used
         FROM capacity_pools p LEFT JOIN capacity_reservations r ON r.pool_id = p.id
         WHERE p.organization_id = $1 AND p.region = $2 AND p.available = true AND ($3::uuid IS NULL OR p.id = $3)
         GROUP BY p.id`, [resolvedOrganizationId, quoteRegion, template?.capacity_pool_id ?? null],
      );
      return { template, organizationId: resolvedOrganizationId, version, rules: rules.rows, pools: pools.rows };
    };
    return transactionClient ? load(transactionClient) : this.db.transaction(load);
  }

  async listPolicies(organizationId: string, page: number, pageSize: number) {
    const count = await this.db.query<{ count: string }>("SELECT count(*)::text AS count FROM negotiation_policies WHERE organization_id = $1", [organizationId]);
    const result = await this.db.query<PolicyRow>(`SELECT id, organization_id, name, maximum_discount_percent, minimum_price, approval_threshold, maximum_attempts, effective_from, effective_to, active, created_by, created_at FROM negotiation_policies WHERE organization_id = $1 ORDER BY effective_from DESC, created_at DESC, id DESC LIMIT $2 OFFSET $3`, [organizationId, pageSize, (page - 1) * pageSize]);
    return { data: result.rows, total: Number(count.rows[0]?.count ?? 0) };
  }

  async findPolicy(id: string, organizationId: string, client?: PoolClient): Promise<PolicyRow | undefined> {
    const executor = (client ?? this.db) as unknown as { query<T extends QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> }; const result = await executor.query<PolicyRow>(`SELECT id, organization_id, name, maximum_discount_percent, minimum_price, approval_threshold, maximum_attempts, effective_from, effective_to, active, created_by, created_at FROM negotiation_policies WHERE id = $1 AND organization_id = $2${client ? " FOR UPDATE" : ""}`, [id, organizationId]); return result.rows[0];
  }

  async createPolicy(input: Record<string, unknown>): Promise<PolicyRow> {
    const result = await this.db.query<PolicyRow>(`INSERT INTO negotiation_policies (organization_id, name, maximum_discount_percent, minimum_price, approval_threshold, maximum_attempts, effective_from, effective_to, active, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9) RETURNING id, organization_id, name, maximum_discount_percent, minimum_price, approval_threshold, maximum_attempts, effective_from, effective_to, active, created_by, created_at`, [input.organizationId, input.name, input.maximumDiscountPercent, input.minimumPrice, input.approvalThreshold, input.maximumAttempts, input.effectiveFrom, input.effectiveTo ?? null, input.createdBy]);
    return result.rows[0];
  }

  async updatePolicy(id: string, organizationId: string, input: Record<string, unknown>, actorId: string): Promise<PolicyRow | undefined> {
    return this.db.transaction(async (client) => {
      const current = await this.findPolicy(id, organizationId, client); if (!current) return undefined;
      if (current.active) throw new ConflictException("Active policy history is immutable; create a new policy version");
      const fields: Array<[string, unknown]> = [["name", input.name], ["maximum_discount_percent", input.maximumDiscountPercent], ["minimum_price", input.minimumPrice], ["approval_threshold", input.approvalThreshold], ["maximum_attempts", input.maximumAttempts], ["effective_from", input.effectiveFrom], ["effective_to", input.effectiveTo]];
      const assignments: string[] = []; const values: unknown[] = [id, organizationId];
      for (const [column, value] of fields) if (value !== undefined) { assignments.push(`${column} = $${values.length + 1}`); values.push(value); }
      if (!assignments.length) return current;
      const result = await client.query<PolicyRow>(`UPDATE negotiation_policies SET ${assignments.join(", ")} WHERE id = $1 AND organization_id = $2 AND active = false RETURNING id, organization_id, name, maximum_discount_percent, minimum_price, approval_threshold, maximum_attempts, effective_from, effective_to, active, created_by, created_at`, values);
      await this.audit.record({ actorId, organizationId, action: "pricing.policy_updated", entityType: "negotiation_policy", entityId: id, oldData: current, newData: result.rows[0] }, client); return result.rows[0];
    });
  }

  async activatePolicy(id: string, organizationId: string, actorId: string): Promise<PolicyRow> {
    return this.db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`policy:${organizationId}`]);
      const current = await this.findPolicy(id, organizationId, client); if (!current) throw new NotFoundException("Negotiation policy not found");
      if (current.active) return current;
      const sameEffective = await client.query("SELECT 1 FROM negotiation_policies WHERE organization_id = $1 AND active = true AND effective_from = $2 AND id <> $3", [organizationId, current.effective_from, id]);
      if (sameEffective.rowCount) throw new ConflictException("Negotiation policy effective dates are ambiguous");
      const future = await client.query<{ effective_from: Date }>("SELECT effective_from FROM negotiation_policies WHERE organization_id = $1 AND active = true AND effective_from > $2 ORDER BY effective_from ASC LIMIT 1 FOR UPDATE", [organizationId, current.effective_from]);
      const futureEffective = future.rows[0]?.effective_from ?? null;
      await client.query(`UPDATE negotiation_policies SET active = false, effective_to = CASE WHEN effective_to IS NULL OR effective_to > $2 THEN $2 ELSE effective_to END WHERE organization_id = $1 AND active = true AND effective_from < $2 AND (effective_to IS NULL OR effective_to > $2)`, [organizationId, current.effective_from]);
      const result = await client.query<PolicyRow>(`UPDATE negotiation_policies SET active = true, effective_to = $3 WHERE id = $1 AND organization_id = $2 RETURNING id, organization_id, name, maximum_discount_percent, minimum_price, approval_threshold, maximum_attempts, effective_from, effective_to, active, created_by, created_at`, [id, organizationId, futureEffective]);
      await this.audit.record({ actorId, organizationId, action: "pricing.policy_activated", entityType: "negotiation_policy", entityId: id, newData: result.rows[0] }, client); return result.rows[0];
    });
  }

  async deactivatePolicy(id: string, organizationId: string, actorId: string): Promise<PolicyRow> {
    return this.db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`policy:${organizationId}`]);
      const current = await this.findPolicy(id, organizationId, client); if (!current) throw new NotFoundException("Negotiation policy not found");
      const result = await client.query<PolicyRow>(`UPDATE negotiation_policies SET active = false, effective_to = CASE WHEN effective_to IS NOT NULL AND effective_to <= NOW() THEN effective_to WHEN effective_from < NOW() THEN NOW() ELSE effective_from + INTERVAL '1 second' END WHERE id = $1 AND organization_id = $2 RETURNING id, organization_id, name, maximum_discount_percent, minimum_price, approval_threshold, maximum_attempts, effective_from, effective_to, active, created_by, created_at`, [id, organizationId]);
      await this.audit.record({ actorId, organizationId, action: "pricing.policy_deactivated", entityType: "negotiation_policy", entityId: id, oldData: current, newData: result.rows[0] }, client); return result.rows[0];
    });
  }

  async effectivePolicy(organizationId: string, at = new Date(), transactionClient?: PoolClient): Promise<PolicyRow | undefined> {
    const executor = (transactionClient ?? this.db) as unknown as { query<T extends QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> };
    const result = await executor.query<PolicyRow>(`SELECT id, organization_id, name, maximum_discount_percent, minimum_price, approval_threshold, maximum_attempts, effective_from, effective_to, active, created_by, created_at FROM negotiation_policies WHERE organization_id = $1 AND active = true AND effective_from <= $2 AND (effective_to IS NULL OR effective_to > $2) ORDER BY effective_from DESC, created_at DESC, id DESC LIMIT 1${transactionClient ? " FOR SHARE" : ""}`, [organizationId, at]); return result.rows[0];
  }

  private async assertTemplateOwnership(client: PoolClient, templateId: string | undefined, organizationId: string): Promise<void> {
    if (!templateId) return;
    const result = await client.query(`SELECT 1 FROM vm_templates WHERE id = $1 AND organization_id = $2`, [templateId, organizationId]); if (!result.rowCount) throw new ConflictException("Pricing rule template belongs to another organization");
  }
}
