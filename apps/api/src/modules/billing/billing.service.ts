import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { DatabaseService } from "../../database/database.service.js";
import { divideHalfUp, formatMoney, parseMoney } from "../pricing/services/money.js";
import { prepaidCoverageEnd, rateProvisionedCompute, type BillingCycle } from "./rating-engine.js";
import type { BillingListQueryDto, InvoiceListQueryDto } from "./dto/billing.dto.js";

interface RatedUsageRow {
  id: string; vm_id: string; customer_id: string; period_start: Date; period_end: Date; runtime_seconds: string;
  order_id: string; accepted_at: Date; rental_duration_days: number; billing_cycle: BillingCycle;
  final_price: string; currency: string; vm_config: Record<string, unknown>; state: string;
}

@Injectable()
export class BillingService {
  constructor(private readonly db: DatabaseService) {}

  async listInvoices(user: AuthenticatedPrincipal, query: InvoiceListQueryDto) {
    await this.markOverdueForCustomer(user.userId);
    const where = ["customer_id = $1"]; const values: unknown[] = [user.userId];
    if (query.status) { values.push(query.status); where.push(`status = $${values.length}`); }
    const count = await this.db.query<{ count: string }>(`SELECT count(*)::text AS count FROM invoices WHERE ${where.join(" AND ")}`, values);
    values.push(query.pageSize, (query.page - 1) * query.pageSize);
    const result = await this.db.query(`SELECT * FROM invoices WHERE ${where.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    return { data: await Promise.all(result.rows.map((row) => this.publicInvoice(row))), pagination: { page: query.page, pageSize: query.pageSize, total: Number(count.rows[0]?.count ?? 0) } };
  }

  async getInvoice(user: AuthenticatedPrincipal, invoiceId: string) {
    await this.markOverdueForCustomer(user.userId);
    const row = (await this.db.query(`SELECT * FROM invoices WHERE id = $1 AND customer_id = $2`, [invoiceId, user.userId])).rows[0];
    if (!row) throw new NotFoundException("Invoice not found");
    return this.publicInvoice(row);
  }

  async listCharges(user: AuthenticatedPrincipal, query: BillingListQueryDto) {
    const where = ["c.customer_id = $1"]; const values: unknown[] = [user.userId];
    if (query.vmId) { values.push(query.vmId); where.push(`c.vm_id = $${values.length}`); }
    if (query.from) { values.push(query.from); where.push(`c.billing_period_end > $${values.length}`); }
    if (query.to) { values.push(query.to); where.push(`c.billing_period_start < $${values.length}`); }
    const count = await this.db.query<{ count: string }>(`SELECT count(*)::text AS count FROM charge_ledger_entries c WHERE ${where.join(" AND ")}`, values);
    values.push(query.pageSize, (query.page - 1) * query.pageSize);
    const result = await this.db.query(`SELECT c.*, u.period_start AS source_period_start, u.period_end AS source_period_end FROM charge_ledger_entries c LEFT JOIN usage_records u ON u.id = c.usage_record_id WHERE ${where.join(" AND ")} ORDER BY c.billing_period_start DESC, c.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    return { data: result.rows, pagination: { page: query.page, pageSize: query.pageSize, total: Number(count.rows[0]?.count ?? 0) } };
  }

  async getCharge(user: AuthenticatedPrincipal, id: string) {
    const result = await this.db.query(`SELECT * FROM charge_ledger_entries WHERE id = $1 AND customer_id = $2`, [id, user.userId]);
    if (!result.rows[0]) throw new NotFoundException("Charge not found");
    return result.rows[0];
  }

  async usageBilling(user: AuthenticatedPrincipal, vmId?: string, query?: BillingListQueryDto) {
    const values: unknown[] = [user.userId]; const where = ["vm.customer_id = $1"];
    if (vmId) { values.push(vmId); where.push(`u.vm_id = $${values.length}`); }
    if (query?.from) { values.push(query.from); where.push(`u.period_end > $${values.length}`); }
    if (query?.to) { values.push(query.to); where.push(`u.period_start < $${values.length}`); }
    const result = await this.db.query(`SELECT u.*, c.id AS charge_id, c.charge_type, c.quantity AS billed_quantity, c.unit_price, c.amount AS billed_amount, c.currency, c.invoice_id FROM usage_records u JOIN virtual_machines vm ON vm.id = u.vm_id LEFT JOIN charge_ledger_entries c ON c.usage_record_id = u.id WHERE ${where.join(" AND ")} ORDER BY u.period_start DESC LIMIT 100`, values);
    return { data: result.rows };
  }

  async summary(user: AuthenticatedPrincipal) {
    await this.markOverdueForCustomer(user.userId);
    const account = (await this.db.query(`SELECT id, currency, balance, status, created_at, updated_at FROM billing_accounts WHERE customer_id = $1`, [user.userId])).rows[0] ?? null;
    const totals = (await this.db.query(`SELECT currency, COALESCE(SUM(total),0)::text AS issued, COALESCE(SUM(amount_paid),0)::text AS paid, COALESCE(SUM(total - amount_paid) FILTER (WHERE status IN ('issued','partially_paid','overdue')),0)::text AS outstanding, COALESCE(SUM(total - amount_paid) FILTER (WHERE status = 'overdue'),0)::text AS overdue, count(*)::int AS invoice_count FROM invoices WHERE customer_id = $1 GROUP BY currency ORDER BY currency`, [user.userId])).rows;
    return { account, totals };
  }

  async markOverdueForCustomer(customerId: string): Promise<void> {
    await this.db.query(`UPDATE invoices SET status = 'overdue', updated_at = NOW() WHERE customer_id = $1 AND status IN ('issued','partially_paid') AND due_at IS NOT NULL AND due_at < NOW() AND amount_paid < total`, [customerId]);
  }

  async issueRecurringInvoices(periodStart: Date, periodEnd: Date): Promise<{ invoices: number; charges: number }> {
    return this.db.transaction(async (client) => {
      const usage = await client.query<RatedUsageRow>(`SELECT u.id, u.vm_id, vm.customer_id, u.period_start, u.period_end, u.runtime_seconds::text, o.id AS order_id, o.accepted_at, o.rental_duration_days, o.billing_cycle, o.final_price, o.currency, o.vm_configuration AS vm_config, vm.state FROM usage_records u JOIN virtual_machines vm ON vm.id = u.vm_id JOIN orders o ON o.id = vm.order_id WHERE u.rated_at IS NULL AND u.period_end > $1 AND u.period_start < $2 AND u.runtime_seconds > 0 AND vm.state <> 'FAILED' ORDER BY u.period_end, u.id FOR UPDATE OF u SKIP LOCKED`, [periodStart, periodEnd]);
      const groups = new Map<string, { customerId: string; currency: string; cycle: BillingCycle; charges: Array<{ usage: RatedUsageRow; amount: string; quantity: string; unitPrice: string; start: Date; end: Date }> }>();
      for (const row of usage.rows) {
        if (row.state === "TERMINATED") continue;
        const periods = row.billing_cycle === "hourly" ? row.rental_duration_days * 24 : row.billing_cycle === "daily" ? row.rental_duration_days : row.rental_duration_days / 30;
        if (!Number.isInteger(periods) || periods <= 0) continue;
        const rate = formatMoney(divideHalfUp(parseMoney(row.final_price), BigInt(periods)));
        const charge = rateProvisionedCompute({ periodStart: new Date(row.period_start), periodEnd: new Date(row.period_end), coverageEnd: prepaidCoverageEnd(new Date(row.accepted_at), row.rental_duration_days), runtimeSeconds: BigInt(row.runtime_seconds), vcpuCount: BigInt(Number(row.vm_config.cpuCores ?? row.vm_config.cpu_cores ?? 0)), ratePerPeriod: rate, billingCycle: row.billing_cycle });
        if (!charge) continue;
        const key = `${row.customer_id}:${row.currency}:${row.billing_cycle}`;
        const group = groups.get(key) ?? { customerId: row.customer_id, currency: row.currency, cycle: row.billing_cycle, charges: [] };
        group.charges.push({ usage: row, amount: charge.amount, quantity: charge.quantity, unitPrice: charge.unitPrice, start: charge.billableStart, end: charge.billableEnd }); groups.set(key, group);
      }
      let invoices = 0; let charges = 0;
      for (const group of groups.values()) {
        const account = (await client.query<{ id: string }>(`SELECT id FROM billing_accounts WHERE customer_id = $1 AND currency = $2 FOR UPDATE`, [group.customerId, group.currency])).rows[0];
        if (!account) continue;
        const period = (await client.query<{ id: string; invoice_id: string | null }>(`INSERT INTO billing_periods (billing_account_id, customer_id, currency, billing_cycle, period_start, period_end, status, claimed_at) VALUES ($1,$2,$3,$4,$5,$6,'processing',NOW()) ON CONFLICT (customer_id,currency,billing_cycle,period_start,period_end) DO UPDATE SET updated_at = NOW() RETURNING id, invoice_id`, [account.id, group.customerId, group.currency, group.cycle, periodStart, periodEnd])).rows[0]!;
        if (period.invoice_id) continue;
        const total = group.charges.reduce((sum, item) => sum + parseMoney(item.amount), 0n);
        if (total <= 0n) continue;
        const invoice = (await client.query<{ id: string }>(`INSERT INTO invoices (invoice_number,billing_account_id,customer_id,invoice_type,currency,billing_period_start,billing_period_end,subtotal,discount_amount,tax_amount,adjustment_amount,total,amount_paid,status,issued_at,due_at) VALUES ($1,$2,$3,'recurring_usage',$4,$5,$6,$7,0,0,0,$7,0,'issued',NOW(),$6 + INTERVAL '7 days') RETURNING id`, [`INV-${randomUUID().replaceAll("-", "").slice(0,18).toUpperCase()}`, account.id, group.customerId, group.currency, periodStart, periodEnd, formatMoney(total)])).rows[0]!;
        let line = 0;
        for (const item of group.charges) {
          const sourceKey = `compute:${item.usage.id}:${item.usage.order_id}:${item.start.toISOString()}:${item.end.toISOString()}`;
          const ledger = (await client.query<{ id: string }>(`INSERT INTO charge_ledger_entries (customer_id,vm_id,usage_record_id,invoice_id,idempotency_key,source_key,charge_type,quantity,unit_price,amount,currency,billing_period_start,billing_period_end) VALUES ($1,$2,$3,$4,$5,$5,'compute',$6,$7,$8,$9,$10,$11) ON CONFLICT (source_key) DO UPDATE SET source_key = EXCLUDED.source_key RETURNING id`, [group.customerId, item.usage.vm_id, item.usage.id, invoice.id, sourceKey, item.quantity, item.unitPrice, item.amount, group.currency, item.start, item.end])).rows[0]!;
          await client.query(`INSERT INTO invoice_items (invoice_id,line_number,item_type,description,quantity,unit_price,amount,charge_ledger_id) VALUES ($1,$2,'compute',$3,$4,$5,$6,$7)`, [invoice.id, ++line, `Provisioned compute for VM ${item.usage.vm_id}`, item.quantity, item.unitPrice, item.amount, ledger.id]);
          await client.query(`UPDATE usage_records SET rated_at = NOW(), invoiced_at = NOW(), charge_ledger_id = $2 WHERE id = $1 AND rated_at IS NULL`, [item.usage.id, ledger.id]); charges++;
        }
        await client.query(`UPDATE billing_periods SET status = 'closed', invoice_id = $2, closed_at = NOW(), updated_at = NOW() WHERE id = $1`, [period.id, invoice.id]); invoices++;
      }
      return { invoices, charges };
    });
  }

  private async publicInvoice(row: Record<string, any>) {
    const items = (await this.db.query(`SELECT id,line_number,item_type,description,quantity,unit_price,amount,charge_ledger_id,created_at FROM invoice_items WHERE invoice_id = $1 ORDER BY line_number`, [row.id])).rows;
    return { id: row.id, invoiceNumber: row.invoice_number, billingAccountId: row.billing_account_id, customerId: row.customer_id, orderId: row.order_id, invoiceType: row.invoice_type, currency: row.currency, billingPeriodStart: row.billing_period_start, billingPeriodEnd: row.billing_period_end, subtotal: row.subtotal, discountAmount: row.discount_amount, taxAmount: row.tax_amount, adjustmentAmount: row.adjustment_amount, total: row.total, amountPaid: row.amount_paid, status: row.status, issuedAt: row.issued_at, dueAt: row.due_at, paidAt: row.paid_at, items };
  }
}
