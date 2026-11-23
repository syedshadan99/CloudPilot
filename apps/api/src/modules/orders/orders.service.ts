import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID, createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { DatabaseService } from "../../database/database.service.js";
import { IdentityService } from "../identity/services/identity.service.js";
import { NegotiationRepository } from "../negotiation/negotiation.repository.js";
import { OffersService } from "../offers/offers.service.js";
import { parseMoney, formatMoney } from "../pricing/services/money.js";
import { SUPPORTED_CURRENCIES } from "../identity/identity.constants.js";
import type { OrderListQueryDto } from "./dto/orders.dto.js";

const RESERVATION_TTL = "24 hours";
const ORDER_PREFIX = "CP";
const INVOICE_PREFIX = "INV";

interface OrderRow {
  id: string;
  customer_id: string;
  organization_id: string;
  offer_id: string;
  order_number: string;
  pricing_version_id: string;
  vm_configuration: Record<string, unknown>;
  base_price: string;
  discount_amount: string;
  final_price: string;
  currency: string;
  billing_cycle: string;
  rental_duration_days: number;
  status: string;
  accepted_at: Date;
  payment_verified_at: Date | null;
  provisioning_eligible_at: Date | null;
  start_at: Date | null;
  end_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  billing_account_id: string;
  customer_id: string;
  order_id: string | null;
  invoice_type: string;
  currency: string;
  billing_period_start: Date;
  billing_period_end: Date;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  adjustment_amount: string;
  total: string;
  amount_paid: string;
  status: string;
  issued_at: Date | null;
  due_at: Date | null;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly identity: IdentityService,
    private readonly offers: OffersService,
    private readonly idem: NegotiationRepository,
    private readonly audit: AuditService,
  ) {}

  async confirmOffer(user: AuthenticatedPrincipal, offerId: string, rawKey: string) {
    await this.identity.assertActiveCustomer(user.userId);
    const key = this.requireIdempotencyKey(rawKey);
    const scope = `order:confirm:${user.userId}:${offerId}`;
    const requestHash = createHash("sha256").update(JSON.stringify({ offerId, actorId: user.userId })).digest("hex");

    return this.db.transaction(async (client) => {
      await this.lockActiveCustomer(client, user.userId);
      const idempotency = await this.idem.beginIdempotency(client, scope, key, requestHash, "order");
      if (idempotency.replay) return idempotency.response;

      // The offer row is the first business aggregate lock. Every counter/decline
      // path uses the same offer lock before changing commercial state.
      const lockedOffer = await this.idem.lockOfferForCustomer(client, offerId, user.userId);
      if (!lockedOffer) throw new NotFoundException("Offer not found");
      const existing = await client.query<OrderRow>(
        `SELECT * FROM orders WHERE offer_id = $1 FOR UPDATE`,
        [lockedOffer.id],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].customer_id !== user.userId) throw new ForbiddenException("Order ownership is not permitted");
        const invoice = await this.invoiceForOrder(client, existing.rows[0].id, user.userId);
        if (!invoice) throw new ConflictException("Accepted order has no initial invoice");
        const response = await this.acceptanceResponse(client, existing.rows[0], invoice);
        await this.idem.completeIdempotency(client, scope, key, response, existing.rows[0].id);
        return response;
      }

      const offer = await this.offers.assertAcceptanceEligibility(client, user.userId, offerId);
      if (!SUPPORTED_CURRENCIES.includes(offer.currency as (typeof SUPPORTED_CURRENCIES)[number])) throw new ConflictException("Offer currency is not supported");
      if (parseMoney(offer.final_price) <= 0n) {
        throw new ConflictException("Zero-value offers are not supported in the first-release payment workflow");
      }
      this.assertConfiguration(offer.vm_configuration);
      const account = await this.lockBillingAccount(client, user.userId, offer.currency);
      const pool = await this.lockAvailablePool(client, offer.organization_id, offer.vm_configuration);
      const order = await this.insertOrder(client, offer);
      await this.insertReservation(client, pool.id, order.id, offer.vm_configuration);
      const invoice = await this.insertInitialInvoice(client, account, order, offer);
      const acceptedOffer = await this.idem.transitionOffer(client, offer, user.userId, "accepted", "customer_confirmation", "Customer accepted the negotiated offer");

      await client.query(
        `INSERT INTO order_events (order_id, actor_id, from_status, to_status, event_type, reason, metadata)
         VALUES ($1,$2,NULL,'pending_payment','order_created',$3,$4::jsonb)`,
        [order.id, user.userId, "Order created from accepted offer", JSON.stringify({ offerId: offer.id, invoiceId: invoice.id, reservationId: await this.reservationId(client, order.id) })],
      );
      await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, deduplication_key, payload)
         VALUES ('order',$1,'order.accepted',$2,$3::jsonb) ON CONFLICT (deduplication_key) DO NOTHING`,
        [order.id, `order.accepted:${order.id}`, JSON.stringify({ orderId: order.id, invoiceId: invoice.id, offerId: offer.id })],
      );
      await this.audit.record({ actorId: user.userId, organizationId: offer.organization_id, action: "order.accepted", entityType: "order", entityId: order.id, newData: { status: order.status, offerId: offer.id, invoiceId: invoice.id, acceptedOfferStatus: acceptedOffer.status } }, client);
      await this.audit.record({ actorId: user.userId, organizationId: offer.organization_id, action: "invoice.issued", entityType: "invoice", entityId: invoice.id, newData: { invoiceNumber: invoice.invoice_number, total: invoice.total, currency: invoice.currency, orderId: order.id } }, client);

      const response = await this.acceptanceResponse(client, order, invoice);
      await this.idem.completeIdempotency(client, scope, key, response, order.id);
      return response;
    });
  }

  async listCustomerOrders(user: AuthenticatedPrincipal, query: OrderListQueryDto) {
    const result = await this.db.query<OrderRow>(
      `SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
      [user.userId, query.pageSize, (query.page - 1) * query.pageSize],
    );
    const count = await this.db.query<{ count: string }>(`SELECT count(*)::text AS count FROM orders WHERE customer_id = $1`, [user.userId]);
    return { data: result.rows.map((row) => this.publicOrder(row)), pagination: { page: query.page, pageSize: query.pageSize, total: Number(count.rows[0]?.count ?? 0) } };
  }

  async getCustomerOrder(user: AuthenticatedPrincipal, orderId: string) {
    const result = await this.db.query<OrderRow>(`SELECT * FROM orders WHERE id = $1 AND customer_id = $2`, [orderId, user.userId]);
    const order = result.rows[0];
    if (!order) throw new NotFoundException("Order not found");
    const invoice = await this.db.query<InvoiceRow>(`SELECT * FROM invoices WHERE order_id = $1 AND invoice_type = 'initial_order'`, [orderId]);
    return { order: this.publicOrder(order), invoice: invoice.rows[0] ? await this.publicInvoice(invoice.rows[0]) : null };
  }

  async orderEvents(user: AuthenticatedPrincipal, orderId: string) {
    await this.assertCustomerOrder(user.userId, orderId);
    const events = await this.db.query(`SELECT id, actor_id, from_status, to_status, event_type, reason, metadata, created_at FROM order_events WHERE order_id = $1 ORDER BY created_at ASC, id ASC`, [orderId]);
    return { orderId, data: events.rows };
  }

  async assertProvisioningOrder(client: PoolClient, orderId: string) {
    const result = await client.query<OrderRow>(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
    const order = result.rows[0];
    if (!order) throw new NotFoundException("Order not found");
    const invoice = await this.invoiceForOrder(client, orderId, order.customer_id);
    if (!invoice || invoice.status !== "paid" || parseMoney(invoice.amount_paid) !== parseMoney(invoice.total)) throw new ConflictException("Order is not fully paid");
    const payment = await client.query(`SELECT 1 FROM payment_records WHERE order_id = $1 AND status = 'verified' AND amount = $2 AND currency = $3 LIMIT 1`, [orderId, invoice.total, invoice.currency]);
    if (!payment.rowCount) throw new ConflictException("No authoritative verified payment exists for this order");
    const reservation = await client.query<{ status: string; expires_at: Date | null }>(`SELECT status, expires_at FROM capacity_reservations WHERE order_id = $1 FOR UPDATE`, [orderId]);
    if (!reservation.rows[0] || reservation.rows[0].status !== "committed") throw new ConflictException("Capacity reservation is not committed");
    if (order.status === "cancelled" || !order.payment_verified_at || !order.provisioning_eligible_at) throw new ConflictException("Order is not provisioning eligible");
    return order;
  }

  publicOrder(row: OrderRow) {
    return { id: row.id, customerId: row.customer_id, organizationId: row.organization_id, offerId: row.offer_id, orderNumber: row.order_number, pricingVersionId: row.pricing_version_id, vmConfiguration: row.vm_configuration, basePrice: row.base_price, discountAmount: row.discount_amount, finalPrice: row.final_price, currency: row.currency, billingCycle: row.billing_cycle, rentalDurationDays: row.rental_duration_days, status: row.status, acceptedAt: row.accepted_at, paymentVerifiedAt: row.payment_verified_at, provisioningEligibleAt: row.provisioning_eligible_at, startAt: row.start_at, endAt: row.end_at, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async publicInvoice(row: InvoiceRow) {
    const items = await this.db.query(`SELECT id, line_number, item_type, description, quantity, unit_price, amount, created_at FROM invoice_items WHERE invoice_id = $1 ORDER BY line_number`, [row.id]);
    return this.publicInvoiceWithItems(row, items.rows);
  }

  publicInvoiceWithItems(row: InvoiceRow, items: unknown[]) {
    return { id: row.id, invoiceNumber: row.invoice_number, billingAccountId: row.billing_account_id, customerId: row.customer_id, orderId: row.order_id, invoiceType: row.invoice_type, currency: row.currency, billingPeriodStart: row.billing_period_start, billingPeriodEnd: row.billing_period_end, subtotal: row.subtotal, discountAmount: row.discount_amount, taxAmount: row.tax_amount, adjustmentAmount: row.adjustment_amount, total: row.total, amountPaid: row.amount_paid, status: row.status, issuedAt: row.issued_at, dueAt: row.due_at, paidAt: row.paid_at, items };
  }

  private async insertOrder(client: PoolClient, offer: Awaited<ReturnType<OffersService["assertAcceptanceEligibility"]>>) {
    const result = await client.query<OrderRow>(
      `INSERT INTO orders (customer_id, organization_id, offer_id, order_number, pricing_version_id, vm_configuration, base_price, discount_amount, final_price, currency, billing_cycle, rental_duration_days, status, accepted_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,'pending_payment',NOW()) RETURNING *`,
      [offer.customer_id, offer.organization_id, offer.id, `${ORDER_PREFIX}-${new Date().toISOString().slice(0,10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`, offer.pricing_version_id, JSON.stringify(offer.vm_configuration), offer.base_price, offer.discount_amount, offer.final_price, offer.currency, offer.billing_cycle, offer.rental_duration_days],
    );
    return result.rows[0]!;
  }

  private async insertInitialInvoice(client: PoolClient, account: { id: string }, order: OrderRow, offer: Awaited<ReturnType<OffersService["assertAcceptanceEligibility"]>>) {
    const result = await client.query<InvoiceRow>(
      `INSERT INTO invoices (invoice_number, billing_account_id, customer_id, order_id, invoice_type, currency, billing_period_start, billing_period_end, subtotal, discount_amount, tax_amount, adjustment_amount, total, amount_paid, status, issued_at, due_at)
       VALUES ($1,$2,$3,$4,'initial_order',$5,NOW(),NOW() + make_interval(days => $6::int),$7,$8,0,0,$9,0,'issued',NOW(),NOW() + INTERVAL '7 days') RETURNING *`,
      [`${INVOICE_PREFIX}-${randomUUID().replaceAll("-", "").slice(0, 18).toUpperCase()}`, account.id, order.customer_id, order.id, order.currency, order.rental_duration_days, offer.base_price, offer.discount_amount, offer.final_price],
    );
    const invoice = result.rows[0]!;
    const base = parseMoney(offer.base_price);
    const discount = parseMoney(offer.discount_amount);
    await client.query(`INSERT INTO invoice_items (invoice_id, line_number, item_type, description, quantity, unit_price, amount) VALUES ($1,1,'setup',$2,1,$3,$3)`, [invoice.id, `${offer.billing_cycle} ${offer.rental_duration_days}-day CloudPilot simulation`, formatMoney(base)]);
    if (discount > 0n) await client.query(`INSERT INTO invoice_items (invoice_id, line_number, item_type, description, quantity, unit_price, amount) VALUES ($1,2,'discount',$2,1,$3,$4)`, [invoice.id, "Negotiated offer discount", formatMoney(-discount), formatMoney(-discount)]);
    return invoice;
  }

  private async lockBillingAccount(client: PoolClient, customerId: string, currency: string) {
    await client.query(`INSERT INTO billing_accounts (customer_id, currency) VALUES ($1,$2) ON CONFLICT (customer_id) DO NOTHING`, [customerId, currency]);
    const result = await client.query<{ id: string; currency: string; status: string }>(`SELECT id, currency, status FROM billing_accounts WHERE customer_id = $1 FOR UPDATE`, [customerId]);
    const account = result.rows[0];
    if (!account) throw new ConflictException("Billing account is unavailable");
    if (account.status !== "active") throw new ConflictException("Billing account is not active");
    if (account.currency !== currency) throw new ConflictException("Billing currency does not match the accepted offer");
    return account;
  }

  private async lockAvailablePool(client: PoolClient, organizationId: string, config: Record<string, unknown>) {
    const region = String(config.region ?? "");
    const cpu = Number(config.cpuCores ?? config.cpu_cores);
    const ram = Number(config.ramGb ?? config.ram_gb);
    const storage = Number(config.storageGb ?? config.storage_gb);
    const pools = await client.query<{ id: string; total_cpu_cores: number; total_ram_gb: number; total_storage_gb: number }>(`SELECT id, total_cpu_cores, total_ram_gb, total_storage_gb FROM capacity_pools WHERE organization_id = $1 AND region = $2 AND available = true ORDER BY id FOR UPDATE`, [organizationId, region]);
    for (const pool of pools.rows) {
      await client.query(`UPDATE capacity_reservations SET status = 'expired', released_at = NOW() WHERE pool_id = $1 AND status = 'held' AND expires_at <= NOW()`, [pool.id]);
      const usage = await client.query<{ cpu: string; ram: string; storage: string }>(`SELECT COALESCE(SUM(cpu_cores) FILTER (WHERE status = 'committed' OR (status = 'held' AND expires_at > NOW())),0)::text cpu, COALESCE(SUM(ram_gb) FILTER (WHERE status = 'committed' OR (status = 'held' AND expires_at > NOW())),0)::text ram, COALESCE(SUM(storage_gb) FILTER (WHERE status = 'committed' OR (status = 'held' AND expires_at > NOW())),0)::text storage FROM capacity_reservations WHERE pool_id = $1`, [pool.id]);
      const used = usage.rows[0]!;
      if (pool.total_cpu_cores - Number(used.cpu) >= cpu && pool.total_ram_gb - Number(used.ram) >= ram && pool.total_storage_gb - Number(used.storage) >= storage) return { id: pool.id };
    }
    throw new ConflictException("Insufficient simulated capacity for this order");
  }

  private async insertReservation(client: PoolClient, poolId: string, orderId: string, config: Record<string, unknown>) {
    await client.query(`INSERT INTO capacity_reservations (pool_id, order_id, status, cpu_cores, ram_gb, storage_gb, expires_at) VALUES ($1,$2,'held',$3,$4,$5,NOW() + INTERVAL '${RESERVATION_TTL}')`, [poolId, orderId, Number(config.cpuCores ?? config.cpu_cores), Number(config.ramGb ?? config.ram_gb), Number(config.storageGb ?? config.storage_gb)]);
  }

  private async reservationId(client: PoolClient, orderId: string): Promise<string | null> {
    const result = await client.query<{ id: string }>(`SELECT id FROM capacity_reservations WHERE order_id = $1`, [orderId]);
    return result.rows[0]?.id ?? null;
  }

  private async invoiceForOrder(client: PoolClient, orderId: string, customerId: string) {
    const result = await client.query<InvoiceRow>(`SELECT * FROM invoices WHERE order_id = $1 AND customer_id = $2 AND invoice_type = 'initial_order' FOR UPDATE`, [orderId, customerId]);
    return result.rows[0];
  }

  private async lockActiveCustomer(client: PoolClient, userId: string) {
    const result = await client.query<{ role: string; status: string }>(`SELECT role, status FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    if (!result.rows[0] || result.rows[0].role !== "customer" || result.rows[0].status !== "active") throw new ForbiddenException("Active customer account required");
  }

  private async assertCustomerOrder(customerId: string, orderId: string) {
    const result = await this.db.query(`SELECT 1 FROM orders WHERE id = $1 AND customer_id = $2`, [orderId, customerId]);
    if (!result.rowCount) throw new NotFoundException("Order not found");
  }

  private assertConfiguration(config: Record<string, unknown>) {
    const values = [config.cpuCores ?? config.cpu_cores, config.ramGb ?? config.ram_gb, config.storageGb ?? config.storage_gb];
    if (!values.every((value) => Number.isInteger(Number(value)) && Number(value) > 0) || typeof (config.region ?? "") !== "string" || !String(config.region).trim()) throw new ConflictException("Offer configuration is incomplete");
  }

  private async acceptanceResponse(client: PoolClient, order: OrderRow, invoice: InvoiceRow) {
    const items = await client.query(`SELECT id, line_number, item_type, description, quantity, unit_price, amount, created_at FROM invoice_items WHERE invoice_id = $1 ORDER BY line_number`, [invoice.id]);
    return { order: this.publicOrder(order), invoice: this.publicInvoiceWithItems(invoice, items.rows) };
  }

  private requireIdempotencyKey(value: string | undefined): string {
    const key = value?.trim() ?? "";
    if (key.length < 8 || key.length > 200) throw new ConflictException("A valid Idempotency-Key header is required");
    return key;
  }
}
