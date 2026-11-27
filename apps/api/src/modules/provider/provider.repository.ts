import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import type { ProviderReportQueryDto } from "./dto/provider.dto.js";

type Query = Pick<ProviderReportQueryDto, "from" | "to" | "status" | "orderStatus" | "vmState" | "invoiceStatus" | "customerId" | "pricingVersionId" | "vmTemplateId" | "currency" | "billingCycle" | "minDiscountPercent" | "maxDiscountPercent">;

interface PageResult<T> {
  rows: T[];
  total: number;
}
export interface InvoiceAllocationRow {
  id: string;
  invoice_number: string;
  invoice_type: string;
  currency: string;
  status: string;
  issued_at: Date | null;
  due_at: Date | null;
  paid_at: Date | null;
  total: string;
  amount_paid: string;
  provider_amount: string;
  provider_outstanding: string;
  provider_overdue: string;
  provider_verified_payments: string;
  attribution_scope: "single_provider" | "shared_invoice";
  provider_count: number;
}

@Injectable()
export class ProviderRepository {
  constructor(private readonly db: DatabaseService) {}

  async listDeals(organizationId: string, query: Query, page: number, pageSize: number): Promise<PageResult<Record<string, unknown>>> {
    const { where, values } = this.dealFilters(organizationId, query);
    const count = await this.db.query<{ count: string }>(`SELECT count(*)::text AS count FROM offers o WHERE ${where.join(" AND ")}`, values);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT o.id, o.customer_id, u.full_name AS customer_name, u.email AS customer_email,
              o.organization_id, o.chat_session_id, o.pricing_version_id, pv.version_name AS pricing_version_name,
              o.negotiation_policy_id, o.vm_template_id, o.vm_configuration, o.base_price,
              o.discount_percent, o.discount_amount, o.final_price, o.currency, o.billing_cycle,
              o.rental_duration_days, o.status, o.provider_review_reason, o.presented_at,
              o.expires_at, o.accepted_at, o.created_at, o.updated_at, o.parent_offer_id,
              ord.id AS order_id, ord.order_number, ord.status AS order_status
       FROM offers o
       JOIN users u ON u.id = o.customer_id
       JOIN pricing_versions pv ON pv.id = o.pricing_version_id AND pv.organization_id = o.organization_id
       LEFT JOIN orders ord ON ord.offer_id = o.id AND ord.organization_id = o.organization_id
       WHERE ${where.join(" AND ")}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, (page - 1) * pageSize],
    );
    return { rows: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
  }

  async getDeal(organizationId: string, offerId: string): Promise<Record<string, unknown> | undefined> {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email,
              pv.version_name, pv.currency AS pricing_currency, pv.effective_from, pv.effective_to,
              np.name AS policy_name, np.maximum_discount_percent, np.minimum_price, np.approval_threshold,
              ord.id AS order_id, ord.order_number, ord.status AS order_status,
              ord.final_price AS order_final_price, ord.accepted_at AS order_accepted_at
       FROM offers o
       JOIN users u ON u.id = o.customer_id
       JOIN pricing_versions pv ON pv.id = o.pricing_version_id AND pv.organization_id = o.organization_id
       JOIN negotiation_policies np ON np.id = o.negotiation_policy_id AND np.organization_id = o.organization_id
       LEFT JOIN orders ord ON ord.offer_id = o.id AND ord.organization_id = o.organization_id
       WHERE o.id = $1 AND o.organization_id = $2`,
      [offerId, organizationId],
    );
    return result.rows[0];
  }

  async getDealEvidence(organizationId: string, offerId: string) {
    const [events, approvals, attempts, requirements, messages, rules] = await Promise.all([
      this.db.query(`SELECT e.id, e.actor_id, e.from_status, e.to_status, e.event_type, e.reason, e.metadata, e.created_at
        FROM offer_events e JOIN offers o ON o.id = e.offer_id
        WHERE e.offer_id = $1 AND o.organization_id = $2 ORDER BY e.created_at ASC, e.id ASC`, [offerId, organizationId]),
      this.db.query(`SELECT a.id, a.reviewer_id, u.full_name AS reviewer_name, a.decision, a.reason, a.decided_at, a.created_at
        FROM offer_approvals a JOIN offers o ON o.id = a.offer_id JOIN users u ON u.id = a.reviewer_id
        WHERE a.offer_id = $1 AND o.organization_id = $2 ORDER BY a.created_at ASC, a.id ASC`, [offerId, organizationId]),
      this.db.query(`SELECT na.id, na.attempt_number, na.request_kind, na.requested_discount_percent,
        na.requested_price, na.outcome, na.reason, na.request_snapshot, na.decision_snapshot, na.offer_id, na.created_at
        FROM negotiation_attempts na JOIN offers o ON o.chat_session_id = na.chat_session_id AND o.organization_id = $2
        WHERE na.offer_id = $1 OR (na.offer_id IS NULL AND o.id = $1)
        ORDER BY na.attempt_number ASC, na.created_at ASC`, [offerId, organizationId]),
      this.db.query(`SELECT r.cpu_cores, r.ram_gb, r.storage_gb, r.os, r.duration_days, r.billing_cycle, r.use_case, r.notes, r.source, r.updated_at
        FROM vm_requirements r JOIN offers o ON o.chat_session_id = r.session_id
        WHERE o.id = $1 AND o.organization_id = $2`, [offerId, organizationId]),
      this.db.query(`SELECT m.id, m.role, m.content, m.created_at
        FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id
        JOIN offers o ON o.chat_session_id = s.id AND o.organization_id = $2
        WHERE o.id = $1 AND m.role IN ('user', 'assistant') ORDER BY m.sequence_no ASC, m.created_at ASC`, [offerId, organizationId]),
      this.db.query(`SELECT pr.id, pr.vm_template_id, vt.name AS vm_template_name, pr.rule_type,
        pr.hourly_rate, pr.daily_rate, pr.monthly_rate, pr.unit_price, pr.minimum_price,
        pr.maximum_discount_percent, pr.metadata, pr.created_at
        FROM pricing_rules pr JOIN offers o ON o.pricing_version_id = pr.pricing_version_id AND o.organization_id = $2
        LEFT JOIN vm_templates vt ON vt.id = pr.vm_template_id
        WHERE o.id = $1 ORDER BY pr.rule_type, pr.id`, [offerId, organizationId]),
    ]);
    return {
      events: events.rows,
      approvals: approvals.rows,
      attempts: attempts.rows,
      requirements: requirements.rows[0] ?? null,
      transcript: messages.rows,
      pricingRules: rules.rows,
    };
  }

  async listCustomers(organizationId: string, query: Query, page: number, pageSize: number): Promise<PageResult<Record<string, unknown>>> {
    const values: unknown[] = [organizationId];
    const filters = ["relationships.customer_id IS NOT NULL"];
    if (query.customerId) { values.push(query.customerId); filters.push(`relationships.customer_id = $${values.length}`); }
    if (query.from) { values.push(query.from); filters.push(`relationships.first_activity_at >= $${values.length}`); }
    if (query.to) { values.push(query.to); filters.push(`relationships.first_activity_at < $${values.length}`); }
    const base = `WITH relationships AS (
        SELECT customer_id, min(activity_at) AS first_activity_at
        FROM (
          SELECT customer_id, created_at AS activity_at FROM offers WHERE organization_id = $1
          UNION ALL
          SELECT customer_id, accepted_at AS activity_at FROM orders WHERE organization_id = $1
        ) activity GROUP BY customer_id
      )`;
    const count = await this.db.query<{ count: string }>(`${base} SELECT count(*)::text AS count FROM relationships WHERE ${filters.join(" AND ")}`, values);
    const rows = await this.db.query<Record<string, unknown>>(
      `${base}
       SELECT relationships.customer_id, u.full_name, u.email, u.status AS account_status,
              relationships.first_activity_at,
              (SELECT count(*)::int FROM offers o WHERE o.organization_id = $1 AND o.customer_id = relationships.customer_id) AS offer_count,
              (SELECT count(*)::int FROM orders o WHERE o.organization_id = $1 AND o.customer_id = relationships.customer_id) AS order_count,
              (SELECT count(*)::int FROM virtual_machines vm JOIN orders o ON o.id = vm.order_id AND o.organization_id = $1 WHERE vm.customer_id = relationships.customer_id) AS vm_count,
              COALESCE((SELECT jsonb_agg(x ORDER BY x.currency) FROM (
                SELECT i.currency, COALESCE(SUM(i.total - i.amount_paid) FILTER (WHERE i.status IN ('issued','partially_paid','overdue')),0)::text AS outstanding
                FROM invoices i JOIN orders o ON o.id = i.order_id AND o.organization_id = $1
                WHERE i.customer_id = relationships.customer_id GROUP BY i.currency
              ) x), '[]'::jsonb) AS outstanding_by_currency,
              (SELECT max(activity_at) FROM (
                SELECT created_at AS activity_at FROM offers WHERE organization_id = $1 AND customer_id = relationships.customer_id
                UNION ALL SELECT accepted_at AS activity_at FROM orders WHERE organization_id = $1 AND customer_id = relationships.customer_id
              ) latest) AS last_activity_at
       FROM relationships JOIN users u ON u.id = relationships.customer_id
       WHERE ${filters.join(" AND ")}
       ORDER BY last_activity_at DESC NULLS LAST, relationships.customer_id
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, (page - 1) * pageSize],
    );
    return { rows: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
  }

  async getCustomer(organizationId: string, customerId: string) {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT u.id, u.full_name, u.email, u.status AS account_status,
        min(activity.created_at) AS first_activity_at, max(activity.created_at) AS last_activity_at,
        count(*) FILTER (WHERE activity.kind = 'offer')::int AS offer_count,
        count(*) FILTER (WHERE activity.kind = 'order')::int AS order_count
       FROM users u JOIN (
         SELECT customer_id, created_at, 'offer' AS kind FROM offers WHERE organization_id = $1
         UNION ALL SELECT customer_id, accepted_at AS created_at, 'order' AS kind FROM orders WHERE organization_id = $1
       ) activity ON activity.customer_id = u.id
       WHERE u.id = $2 GROUP BY u.id, u.full_name, u.email, u.status`, [organizationId, customerId]);
    if (!result.rows[0]) return undefined;
    const [deals, orders, vms] = await Promise.all([
      this.listDeals(organizationId, { customerId }, 1, 100),
      this.listOrders(organizationId, { customerId }, 1, 100),
      this.listVms(organizationId, { customerId }, 1, 100),
    ]);
    return { customer: result.rows[0], deals: deals.rows, orders: orders.rows, vms: vms.rows };
  }

  async listOrders(organizationId: string, query: Query, page: number, pageSize: number): Promise<PageResult<Record<string, unknown>>> {
    const { where, values } = this.orderFilters(organizationId, query);
    const count = await this.db.query<{ count: string }>(`SELECT count(*)::text AS count FROM orders o WHERE ${where.join(" AND ")}`, values);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT o.id, o.order_number, o.customer_id, u.full_name AS customer_name, o.offer_id, o.pricing_version_id,
              o.vm_configuration, o.base_price, o.discount_amount, o.final_price, o.currency,
              o.billing_cycle, o.rental_duration_days, o.status, o.accepted_at, o.payment_verified_at,
              o.provisioning_eligible_at, o.start_at, o.end_at, o.created_at, o.updated_at,
              i.id AS invoice_id, i.status AS invoice_status, i.total AS invoice_total,
              p.status AS payment_status, pj.status AS provisioning_status,
              vm.id AS vm_id, vm.state AS vm_state
       FROM orders o JOIN users u ON u.id = o.customer_id
       LEFT JOIN invoices i ON i.order_id = o.id AND i.invoice_type = 'initial_order'
       LEFT JOIN payment_records p ON p.order_id = o.id AND p.status = 'verified'
       LEFT JOIN provisioning_jobs pj ON pj.order_id = o.id
       LEFT JOIN virtual_machines vm ON vm.order_id = o.id
       WHERE ${where.join(" AND ")}
       ORDER BY o.accepted_at DESC, o.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, (page - 1) * pageSize],
    );
    return { rows: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
  }

  async listVms(organizationId: string, query: Query, page: number, pageSize: number): Promise<PageResult<Record<string, unknown>>> {
    const values: unknown[] = [organizationId];
    const where = ["o.organization_id = $1"];
    if (query.customerId) { values.push(query.customerId); where.push(`vm.customer_id = $${values.length}`); }
    if (query.vmState) { values.push(query.vmState); where.push(`vm.state = $${values.length}`); }
    if (query.from) { values.push(query.from); where.push(`vm.created_at >= $${values.length}`); }
    if (query.to) { values.push(query.to); where.push(`vm.created_at < $${values.length}`); }
    const count = await this.db.query<{ count: string }>(`SELECT count(*)::text AS count FROM virtual_machines vm JOIN orders o ON o.id = vm.order_id WHERE ${where.join(" AND ")}`, values);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT vm.id, vm.order_id, vm.customer_id, u.full_name AS customer_name, vm.state,
              vm.simulated_vm_id, vm.hostname, vm.created_at, vm.updated_at, vm.started_at, vm.stopped_at,
              vm.terminated_at, vm.access_granted_at, vm.vm_config, vm.cpu_cores, vm.ram_gb, vm.storage_gb,
              vm.operating_system, vm.region, o.order_number, pj.status AS provisioning_status,
              pj.last_error AS provisioning_error
       FROM virtual_machines vm JOIN orders o ON o.id = vm.order_id
       JOIN users u ON u.id = vm.customer_id LEFT JOIN provisioning_jobs pj ON pj.order_id = o.id
       WHERE ${where.join(" AND ")}
       ORDER BY vm.created_at DESC, vm.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, (page - 1) * pageSize],
    );
    return { rows: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
  }

  async listPricing(organizationId: string, page: number, pageSize: number): Promise<PageResult<Record<string, unknown>>> {
    const count = await this.db.query<{ count: string }>(`SELECT count(*)::text AS count FROM pricing_versions WHERE organization_id = $1`, [organizationId]);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT pv.id, pv.version_name, pv.organization_id, pv.currency, pv.effective_from, pv.effective_to,
              pv.status, pv.created_by, pv.created_at, u.full_name AS created_by_name,
              (SELECT count(*)::int FROM offers o WHERE o.pricing_version_id = pv.id AND o.organization_id = pv.organization_id) AS offer_count,
              (SELECT count(*)::int FROM orders o WHERE o.pricing_version_id = pv.id AND o.organization_id = pv.organization_id) AS order_count,
              COALESCE((SELECT jsonb_agg(r ORDER BY r.rule_type, r.id) FROM (
                SELECT pr.id, pr.vm_template_id, pr.rule_type, pr.hourly_rate, pr.daily_rate, pr.monthly_rate,
                       pr.unit_price, pr.minimum_price, pr.maximum_discount_percent, pr.metadata, pr.created_at
                FROM pricing_rules pr WHERE pr.pricing_version_id = pv.id
              ) r), '[]'::jsonb) AS rules
       FROM pricing_versions pv JOIN users u ON u.id = pv.created_by
       WHERE pv.organization_id = $1 ORDER BY pv.effective_from DESC, pv.id DESC
       LIMIT $2 OFFSET $3`, [organizationId, pageSize, (page - 1) * pageSize]);
    return { rows: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
  }

  async getPricing(organizationId: string, versionId: string) {
    const result = await this.db.query<Record<string, unknown>>(
      `SELECT pv.id, pv.version_name, pv.organization_id, pv.currency, pv.effective_from, pv.effective_to,
        pv.status, pv.created_by, pv.created_at, u.full_name AS created_by_name,
        COALESCE((SELECT jsonb_agg(pr ORDER BY pr.rule_type, pr.id) FROM pricing_rules pr WHERE pr.pricing_version_id = pv.id), '[]'::jsonb) AS rules
       FROM pricing_versions pv JOIN users u ON u.id = pv.created_by
       WHERE pv.id = $1 AND pv.organization_id = $2`, [versionId, organizationId]);
    return result.rows[0];
  }

  async invoiceAllocations(organizationId: string, query: Query, page?: number, pageSize?: number): Promise<PageResult<InvoiceAllocationRow>> {
    const values: unknown[] = [organizationId];
    const filters = ["a.organization_id = $1", "a.provider_amount::numeric <> 0"];
    if (query.from) { values.push(query.from); filters.push(`a.issued_at >= $${values.length}`); }
    if (query.to) { values.push(query.to); filters.push(`a.issued_at < $${values.length}`); }
    if (query.invoiceStatus) { values.push(query.invoiceStatus); filters.push(`a.status = $${values.length}`); }
    if (query.currency) { values.push(query.currency); filters.push(`a.currency = $${values.length}`); }
    const cte = this.invoiceAllocationCte();
    const count = await this.db.query<{ count: string }>(`${cte} SELECT count(*)::text AS count FROM allocations a WHERE ${filters.join(" AND ")}`, values);
    const limit = pageSize ?? 100;
    const offset = page ? (page - 1) * limit : 0;
    const rows = await this.db.query<InvoiceAllocationRow>(
      `${cte} SELECT a.* FROM allocations a WHERE ${filters.join(" AND ")}
       ORDER BY a.issued_at DESC NULLS LAST, a.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );
    return { rows: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
  }

  async financialSummary(organizationId: string, query: Query) {
    const values: unknown[] = [organizationId];
    const filters = ["a.organization_id = $1", "a.provider_amount::numeric <> 0"];
    if (query.from) { values.push(query.from); filters.push(`a.issued_at >= $${values.length}`); }
    if (query.to) { values.push(query.to); filters.push(`a.issued_at < $${values.length}`); }
    if (query.invoiceStatus) { values.push(query.invoiceStatus); filters.push(`a.status = $${values.length}`); }
    if (query.currency) { values.push(query.currency); filters.push(`a.currency = $${values.length}`); }
    const result = await this.db.query<{
      currency: string;
      invoice_count: number;
      invoiced_amount: string;
      verified_simulated_payments: string;
      outstanding_amount: string;
      overdue_amount: string;
      shared_invoice_count: number;
      overdue_invoice_count: number;
    }>(`${this.invoiceAllocationCte()}
      SELECT a.currency, count(*)::int AS invoice_count,
        SUM(a.provider_amount::numeric)::numeric(19,4)::text AS invoiced_amount,
        SUM(a.provider_verified_payments::numeric)::numeric(19,4)::text AS verified_simulated_payments,
        SUM(a.provider_outstanding::numeric)::numeric(19,4)::text AS outstanding_amount,
        SUM(a.provider_overdue::numeric)::numeric(19,4)::text AS overdue_amount,
        count(*) FILTER (WHERE a.attribution_scope = 'shared_invoice')::int AS shared_invoice_count,
        count(*) FILTER (WHERE a.status = 'overdue')::int AS overdue_invoice_count
      FROM allocations a WHERE ${filters.join(" AND ")} GROUP BY a.currency ORDER BY a.currency`, values);
    return result.rows.map((row) => ({
      currency: row.currency,
      invoiceCount: row.invoice_count,
      invoicedAmount: row.invoiced_amount,
      verifiedSimulatedPayments: row.verified_simulated_payments,
      outstandingAmount: row.outstanding_amount,
      overdueAmount: row.overdue_amount,
      sharedInvoiceCount: row.shared_invoice_count,
      overdueInvoiceCount: row.overdue_invoice_count,
    }));
  }

  async activity(organizationId: string, limit = 25) {
    const result = await this.db.query(
      `SELECT id, action AS event_type, entity_type, entity_id, reason, new_data, created_at
       FROM audit_logs WHERE organization_id = $1
       ORDER BY created_at DESC, id DESC LIMIT $2`, [organizationId, limit]);
    return result.rows;
  }

  async dashboardCounts(organizationId: string, query: Query) {
    const values: unknown[] = [organizationId];
    const range = (column: string) => {
      const clauses: string[] = [];
      if (query.from) { values.push(query.from); clauses.push(`${column} >= $${values.length}`); }
      if (query.to) { values.push(query.to); clauses.push(`${column} < $${values.length}`); }
      return clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
    };
    const result = await this.db.query<Record<string, string>>(
      `SELECT
       (SELECT count(DISTINCT customer_id)::text FROM (
          SELECT customer_id FROM offers WHERE organization_id = $1
          UNION SELECT customer_id FROM orders WHERE organization_id = $1
        ) customers) AS total_customers,
       (SELECT count(*)::text FROM virtual_machines vm JOIN orders o ON o.id = vm.order_id WHERE o.organization_id = $1 AND vm.state NOT IN ('TERMINATED','FAILED')) AS active_vms,
       (SELECT count(*)::text FROM offers WHERE organization_id = $1 AND status = 'pending_provider_review' AND (expires_at IS NULL OR expires_at > NOW())) AS pending_deal_reviews,
       (SELECT count(*)::text FROM offers WHERE organization_id = $1 AND status = 'accepted'${range("accepted_at")}) AS accepted_offers,
       (SELECT count(*)::text FROM orders WHERE organization_id = $1 AND status = 'completed'${range("accepted_at")}) AS completed_orders,
       (SELECT count(*)::text FROM provisioning_jobs pj JOIN orders o ON o.id = pj.order_id WHERE o.organization_id = $1 AND pj.status = 'FAILED'${range("pj.created_at")}) AS failed_provisioning_jobs,
       (SELECT count(*)::text FROM invoices i JOIN orders o ON o.id = i.order_id WHERE o.organization_id = $1${range("i.issued_at")}) AS issued_initial_invoices,
       (SELECT count(*)::text FROM invoices i JOIN orders o ON o.id = i.order_id WHERE o.organization_id = $1 AND i.status = 'overdue'${range("i.issued_at")}) AS overdue_invoice_count,
       (SELECT COALESCE(avg(discount_percent),0)::text FROM offers WHERE organization_id = $1 AND status = 'accepted'${range("accepted_at")}) AS average_accepted_discount`
      , values);
    return result.rows[0]!;
  }

  async dealAnalytics(organizationId: string, query: Query) {
    const values: unknown[] = [organizationId];
    const conditions = ["organization_id = $1"];
    if (query.from) { values.push(query.from); conditions.push(`created_at >= $${values.length}`); }
    if (query.to) { values.push(query.to); conditions.push(`created_at < $${values.length}`); }
    const result = await this.db.query(`SELECT status, count(*)::int AS count, COALESCE(avg(discount_percent),0)::text AS average_discount FROM offers WHERE ${conditions.join(" AND ")} GROUP BY status ORDER BY status`, values);
    return result.rows;
  }

  async revenueTrend(organizationId: string, query: Query) {
    const values: unknown[] = [organizationId];
    const filters = ["a.organization_id = $1", "a.issued_at IS NOT NULL"];
    if (query.from) { values.push(query.from); filters.push(`a.issued_at >= $${values.length}`); }
    if (query.to) { values.push(query.to); filters.push(`a.issued_at < $${values.length}`); }
    const result = await this.db.query(`${this.invoiceAllocationCte()}
      SELECT date_trunc('month', a.issued_at AT TIME ZONE 'UTC')::date AS period, a.currency,
        count(*)::int AS invoice_count, SUM(a.provider_amount::numeric)::numeric(19,4)::text AS invoiced_amount,
        SUM(a.provider_verified_payments::numeric)::numeric(19,4)::text AS verified_simulated_payments,
        SUM(a.provider_outstanding::numeric)::numeric(19,4)::text AS outstanding_amount,
        SUM(a.provider_overdue::numeric)::numeric(19,4)::text AS overdue_amount
      FROM allocations a WHERE ${filters.join(" AND ")}
      GROUP BY period, a.currency ORDER BY period ASC, a.currency ASC`, values);
    return result.rows;
  }

  async discountAnalytics(organizationId: string, query: Query) {
    const values: unknown[] = [organizationId];
    const filters = ["organization_id = $1"];
    if (query.from) { values.push(query.from); filters.push(`accepted_at >= $${values.length}`); }
    if (query.to) { values.push(query.to); filters.push(`accepted_at < $${values.length}`); }
    const result = await this.db.query(`SELECT currency, count(*)::int AS accepted_offer_count,
      COALESCE(avg(discount_percent),0)::text AS average_accepted_discount_percent,
      COALESCE(avg(discount_amount),0)::numeric(19,4)::text AS average_accepted_discount_amount
      FROM offers WHERE status = 'accepted' AND ${filters.join(" AND ")} GROUP BY currency ORDER BY currency`, values);
    const offered = await this.db.query(`SELECT currency, count(*)::int AS offer_count,
      COALESCE(avg(discount_percent),0)::text AS average_offered_discount_percent
      FROM offers WHERE ${filters.join(" AND ")} GROUP BY currency ORDER BY currency`, values);
    return { accepted: result.rows, offered: offered.rows };
  }

  async conversionFunnel(organizationId: string, query: Query) {
    const values: unknown[] = [organizationId];
    const filters = ["organization_id = $1"];
    if (query.from) { values.push(query.from); filters.push(`created_at >= $${values.length}`); }
    if (query.to) { values.push(query.to); filters.push(`created_at < $${values.length}`); }
    const result = await this.db.query<Record<string, string>>(`SELECT
      count(DISTINCT customer_id)::text AS negotiated_customers,
      count(DISTINCT customer_id) FILTER (WHERE status IN ('presented','pending_provider_review','approved','accepted'))::text AS presented_customers,
      count(DISTINCT customer_id) FILTER (WHERE status = 'approved' OR status = 'accepted')::text AS approved_customers,
      count(DISTINCT customer_id) FILTER (WHERE status = 'accepted')::text AS accepted_customers
      FROM offers WHERE ${filters.join(" AND ")}`, values);
    const counts = result.rows[0]!;
    const orders = await this.db.query<{ count: string }>(`SELECT count(DISTINCT customer_id)::text AS count FROM orders WHERE organization_id = $1${query.from ? ` AND accepted_at >= $2` : ""}${query.to ? ` AND accepted_at < $${query.from ? 3 : 2}` : ""}`, [organizationId, ...(query.from ? [query.from] : []), ...(query.to ? [query.to] : [])]);
    const paid = await this.db.query<{ count: string }>(`SELECT count(DISTINCT o.customer_id)::text AS count FROM orders o JOIN invoices i ON i.order_id = o.id AND i.invoice_type = 'initial_order' JOIN payment_records p ON p.invoice_id = i.id AND p.status = 'verified' WHERE o.organization_id = $1${query.from ? ` AND p.verified_at >= $2` : ""}${query.to ? ` AND p.verified_at < $${query.from ? 3 : 2}` : ""}`, [organizationId, ...(query.from ? [query.from] : []), ...(query.to ? [query.to] : [])]);
    return { population: "distinct_customers", stages: [
      { name: "negotiated", count: Number(counts.negotiated_customers) },
      { name: "presented", count: Number(counts.presented_customers) },
      { name: "providerApproved", count: Number(counts.approved_customers) },
      { name: "offerAccepted", count: Number(counts.accepted_customers) },
      { name: "orderCreated", count: Number(orders.rows[0]?.count ?? 0) },
      { name: "simulatedPaymentVerified", count: Number(paid.rows[0]?.count ?? 0) },
    ] };
  }

  async vmAnalytics(organizationId: string, query: Query) {
    const values: unknown[] = [organizationId];
    const conditions = ["o.organization_id = $1"];
    if (query.from) { values.push(query.from); conditions.push(`vm.created_at >= $${values.length}`); }
    if (query.to) { values.push(query.to); conditions.push(`vm.created_at < $${values.length}`); }
    const states = await this.db.query(`SELECT vm.state, count(*)::int AS count FROM virtual_machines vm JOIN orders o ON o.id = vm.order_id WHERE ${conditions.join(" AND ")} GROUP BY vm.state ORDER BY vm.state`, values);
    const failures = await this.db.query(`SELECT count(*)::int AS count FROM provisioning_jobs pj JOIN orders o ON o.id = pj.order_id WHERE o.organization_id = $1 AND pj.status = 'FAILED'${query.from ? ` AND pj.created_at >= $2` : ""}${query.to ? ` AND pj.created_at < $${query.from ? 3 : 2}` : ""}`, [organizationId, ...(query.from ? [query.from] : []), ...(query.to ? [query.to] : [])]);
    return { stateDistribution: states.rows, provisioningFailures: Number(failures.rows[0]?.count ?? 0) };
  }

  private dealFilters(organizationId: string, query: Query) {
    const values: unknown[] = [organizationId];
    const where = ["o.organization_id = $1"];
    if (query.status) { values.push(query.status); where.push(`o.status = $${values.length}`); }
    if (query.status === "pending_provider_review") where.push("(o.expires_at IS NULL OR o.expires_at > NOW())");
    if (query.customerId) { values.push(query.customerId); where.push(`o.customer_id = $${values.length}`); }
    if (query.pricingVersionId) { values.push(query.pricingVersionId); where.push(`o.pricing_version_id = $${values.length}`); }
    if (query.vmTemplateId) { values.push(query.vmTemplateId); where.push(`o.vm_template_id = $${values.length}`); }
    if (query.currency) { values.push(query.currency); where.push(`o.currency = $${values.length}`); }
    if (query.billingCycle) { values.push(query.billingCycle); where.push(`o.billing_cycle = $${values.length}`); }
    if (query.from) { values.push(query.from); where.push(`o.created_at >= $${values.length}`); }
    if (query.to) { values.push(query.to); where.push(`o.created_at < $${values.length}`); }
    if (query.minDiscountPercent) { values.push(query.minDiscountPercent); where.push(`o.discount_percent >= $${values.length}`); }
    if (query.maxDiscountPercent) { values.push(query.maxDiscountPercent); where.push(`o.discount_percent <= $${values.length}`); }
    return { where, values };
  }

  private orderFilters(organizationId: string, query: Query) {
    const values: unknown[] = [organizationId];
    const where = ["o.organization_id = $1"];
    if (query.orderStatus) { values.push(query.orderStatus); where.push(`o.status = $${values.length}`); }
    if (query.customerId) { values.push(query.customerId); where.push(`o.customer_id = $${values.length}`); }
    if (query.currency) { values.push(query.currency); where.push(`o.currency = $${values.length}`); }
    if (query.billingCycle) { values.push(query.billingCycle); where.push(`o.billing_cycle = $${values.length}`); }
    if (query.from) { values.push(query.from); where.push(`o.accepted_at >= $${values.length}`); }
    if (query.to) { values.push(query.to); where.push(`o.accepted_at < $${values.length}`); }
    return { where, values };
  }

  private invoiceAllocationCte() {
    return `WITH invoice_orgs AS (
      SELECT i.id, count(DISTINCT o.organization_id)::int AS provider_count
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      LEFT JOIN charge_ledger_entries cle ON cle.id = ii.charge_ledger_id
      LEFT JOIN virtual_machines vm ON vm.id = cle.vm_id
      LEFT JOIN orders o ON o.id = COALESCE(i.order_id, vm.order_id)
      GROUP BY i.id
    ), allocations AS (
      SELECT i.id, i.invoice_number, i.invoice_type, i.currency, i.status, i.issued_at, i.due_at, i.paid_at,
        i.total::text, i.amount_paid::text, o.organization_id,
        i.total::text AS provider_amount,
        GREATEST(i.total - i.amount_paid, 0)::text AS provider_outstanding,
        CASE WHEN i.status = 'overdue' THEN GREATEST(i.total - i.amount_paid, 0) ELSE 0 END::text AS provider_overdue,
        COALESCE(p.verified_amount, 0)::text AS provider_verified_payments,
        'single_provider'::text AS attribution_scope, 1::int AS provider_count
      FROM invoices i JOIN orders o ON o.id = i.order_id
      JOIN invoice_orgs io ON io.id = i.id AND io.provider_count = 1
      LEFT JOIN (SELECT invoice_id, SUM(amount) FILTER (WHERE status = 'verified') AS verified_amount FROM payment_records GROUP BY invoice_id) p ON p.invoice_id = i.id
      UNION ALL
      SELECT i.id, i.invoice_number, i.invoice_type, i.currency, i.status, i.issued_at, i.due_at, i.paid_at,
        i.total::text, i.amount_paid::text, o.organization_id,
        SUM(ii.amount)::numeric(19,4)::text AS provider_amount,
        CASE WHEN i.subtotal > 0 THEN (GREATEST(i.total - i.amount_paid,0) * SUM(ii.amount) / i.subtotal)::numeric(19,4)::text ELSE '0.0000' END AS provider_outstanding,
        CASE WHEN i.status = 'overdue' AND i.subtotal > 0 THEN ((GREATEST(i.total - i.amount_paid,0) * SUM(ii.amount) / i.subtotal))::numeric(19,4)::text ELSE '0.0000' END AS provider_overdue,
        '0.0000'::text AS provider_verified_payments,
        'shared_invoice'::text AS attribution_scope, io.provider_count
      FROM invoices i JOIN invoice_items ii ON ii.invoice_id = i.id
      JOIN charge_ledger_entries cle ON cle.id = ii.charge_ledger_id
      JOIN virtual_machines vm ON vm.id = cle.vm_id
      JOIN orders o ON o.id = vm.order_id
      JOIN invoice_orgs io ON io.id = i.id AND io.provider_count > 1
      GROUP BY i.id, i.invoice_number, i.invoice_type, i.currency, i.status, i.issued_at, i.due_at, i.paid_at, i.total, i.amount_paid, i.subtotal, o.organization_id, io.provider_count
    )`;
  }
}
