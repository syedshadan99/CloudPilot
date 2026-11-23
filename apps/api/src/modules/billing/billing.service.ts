import { Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { DatabaseService } from "../../database/database.service.js";
import { OrdersService, type InvoiceRow } from "../orders/orders.service.js";
import type { InvoiceListQueryDto } from "./dto/billing.dto.js";

@Injectable()
export class BillingService {
  constructor(private readonly db: DatabaseService, private readonly orders: OrdersService) {}

  async listInvoices(user: AuthenticatedPrincipal, query: InvoiceListQueryDto) {
    const result = await this.db.query<InvoiceRow>(`SELECT * FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`, [user.userId, query.pageSize, (query.page - 1) * query.pageSize]);
    const count = await this.db.query<{ count: string }>(`SELECT count(*)::text AS count FROM invoices WHERE customer_id = $1`, [user.userId]);
    return { data: await Promise.all(result.rows.map((row) => this.orders.publicInvoice(row))), pagination: { page: query.page, pageSize: query.pageSize, total: Number(count.rows[0]?.count ?? 0) } };
  }

  async getInvoice(user: AuthenticatedPrincipal, invoiceId: string) {
    const result = await this.db.query<InvoiceRow>(`SELECT * FROM invoices WHERE id = $1 AND customer_id = $2`, [invoiceId, user.userId]);
    if (!result.rows[0]) throw new NotFoundException("Invoice not found");
    return this.orders.publicInvoice(result.rows[0]);
  }

  async summary(user: AuthenticatedPrincipal) {
    const account = await this.db.query(`SELECT id, currency, balance, status, created_at, updated_at FROM billing_accounts WHERE customer_id = $1`, [user.userId]);
    const totals = await this.db.query<{ issued: string; paid: string; outstanding: string }>(`SELECT COALESCE(SUM(total),0)::text AS issued, COALESCE(SUM(amount_paid),0)::text AS paid, COALESCE(SUM(total - amount_paid) FILTER (WHERE status IN ('issued','partially_paid','overdue')),0)::text AS outstanding FROM invoices WHERE customer_id = $1`, [user.userId]);
    return { account: account.rows[0] ?? null, totals: totals.rows[0] ?? { issued: "0.0000", paid: "0.0000", outstanding: "0.0000" } };
  }
}
