import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID, createHash } from "node:crypto";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { DatabaseService } from "../../database/database.service.js";
import { NegotiationRepository } from "../negotiation/negotiation.repository.js";
import { parseMoney } from "../pricing/services/money.js";
import type { PaymentListQueryDto, SimulatedPaymentDto } from "./dto/payments.dto.js";
import { evaluateSimulatedPayment } from "./payment-rules.js";

@Injectable()
export class PaymentsService {
  constructor(private readonly db: DatabaseService, private readonly idem: NegotiationRepository, private readonly audit: AuditService) {}

  async submit(user: AuthenticatedPrincipal, dto: SimulatedPaymentDto, rawKey: string) {
    const key = rawKey.trim();
    if (key.length < 8 || key.length > 200) throw new ConflictException("A valid Idempotency-Key header is required");
    const amount = parseMoney(dto.amount);
    if (amount <= 0n) throw new ConflictException("Simulated payment amount must be positive");
    const currency = dto.currency.toUpperCase();
    const scope = `payment:simulated:${user.userId}:${dto.invoiceId}`;
    const hash = createHash("sha256").update(JSON.stringify({ invoiceId: dto.invoiceId, amount: dto.amount, currency, actorId: user.userId })).digest("hex");

    return this.db.transaction(async (client) => {
      const idempotency = await this.idem.beginIdempotency(client, scope, key, hash, "payment");
      if (idempotency.replay) return idempotency.response;
      const invoiceResult = await client.query<{ id: string; invoice_number: string; order_id: string | null; customer_id: string; billing_account_id: string; currency: string; total: string; amount_paid: string; status: string }>(`SELECT * FROM invoices WHERE id = $1 AND customer_id = $2 FOR UPDATE`, [dto.invoiceId, user.userId]);
      const invoice = invoiceResult.rows[0];
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (!invoice.order_id) throw new ConflictException("Only an initial order invoice can be paid in this release");
      const orderResult = await client.query<{ id: string; customer_id: string; organization_id: string; status: string }>(`SELECT id, customer_id, organization_id, status FROM orders WHERE id = $1 FOR UPDATE`, [invoice.order_id]);
      const order = orderResult.rows[0];
      if (!order || order.customer_id !== user.userId) throw new NotFoundException("Order not found");
      if (order.status === "cancelled") throw new ConflictException("Cancelled orders cannot be paid");
      const existing = await client.query(`SELECT id, payment_reference, amount, currency, status, failure_reason, submitted_at, verified_at FROM payment_records WHERE invoice_id = $1 AND status = 'verified' ORDER BY created_at LIMIT 1`, [invoice.id]);
      if (existing.rows[0]) {
        const response = this.paymentResponse(existing.rows[0], invoice, order);
        await this.idem.completeIdempotency(client, scope, key, response, existing.rows[0].id);
        return response;
      }
      if (invoice.status === "void" || invoice.status === "uncollectible") throw new ConflictException("Invoice cannot be paid in its current state");
      const previouslyPaid = parseMoney(invoice.amount_paid);
      const decision = previouslyPaid > 0n
        ? { status: "failed" as const, failureReason: "Partial payment accumulation is not supported in the first release" }
        : evaluateSimulatedPayment(dto.amount, invoice.total, currency, invoice.currency);
      let status = decision.status;
      let failureReason = decision.failureReason;

      const reservation = await client.query<{ id: string; status: string; expires_at: Date | null }>(`SELECT id, status, expires_at FROM capacity_reservations WHERE order_id = $1 FOR UPDATE`, [order.id]);
      if (status === "verified" && (!reservation.rows[0] || reservation.rows[0].status !== "held" || (reservation.rows[0].expires_at && new Date(reservation.rows[0].expires_at).getTime() <= Date.now()))) {
        status = "failed";
        failureReason = "The order's capacity reservation is no longer valid";
      }
      const payment = await client.query(`INSERT INTO payment_records (invoice_id, order_id, customer_id, payment_reference, provider, amount, currency, status, failure_reason, verified_at, verified_by) VALUES ($1,$2,$3,$4,'simulated',$5,$6,$7,$8,CASE WHEN $7 = 'verified' THEN NOW() END,$3) RETURNING id, payment_reference, amount, currency, status, failure_reason, submitted_at, verified_at`, [invoice.id, order.id, user.userId, `SIM-${randomUUID().replaceAll("-", "").toUpperCase()}`, dto.amount, currency, status, failureReason]);
      const paymentRow = payment.rows[0];
      if (status === "verified") {
        await client.query(`UPDATE capacity_reservations SET status = 'committed', committed_at = NOW() WHERE order_id = $1 AND status = 'held'`, [order.id]);
        await client.query(`UPDATE invoices SET amount_paid = total, status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = $1`, [invoice.id]);
        await client.query(`UPDATE orders SET status = 'payment_verified', payment_verified_at = NOW(), provisioning_eligible_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'pending_payment'`, [order.id]);
        await client.query(`INSERT INTO order_events (order_id, actor_id, from_status, to_status, event_type, reason, metadata) VALUES ($1,$2,'pending_payment','payment_verified','payment_verified','Backend-verified simulated payment',$3::jsonb)`, [order.id, user.userId, JSON.stringify({ paymentId: paymentRow.id, invoiceId: invoice.id })]);
        await client.query(`INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, deduplication_key, payload) VALUES ('order',$1,'provisioning.eligible',$2,$3::jsonb) ON CONFLICT (deduplication_key) DO NOTHING`, [order.id, `provisioning.eligible:${order.id}`, JSON.stringify({ orderId: order.id, paymentId: paymentRow.id })]);
        await this.audit.record({ actorId: user.userId, organizationId: order.organization_id, action: "payment.simulated_verified", entityType: "payment", entityId: paymentRow.id, newData: { orderId: order.id, invoiceId: invoice.id, amount: dto.amount, currency, simulation: true } }, client);
        await this.audit.record({ actorId: user.userId, organizationId: order.organization_id, action: "invoice.paid", entityType: "invoice", entityId: invoice.id, newData: { amountPaid: invoice.total, status: "paid", simulation: true } }, client);
      } else {
        await this.audit.record({ actorId: user.userId, organizationId: order.organization_id, action: "payment.simulated_failed", entityType: "payment", entityId: paymentRow.id, newData: { orderId: order.id, invoiceId: invoice.id, failureReason, simulation: true } }, client);
      }
      const response = this.paymentResponse(paymentRow, { ...invoice, amount_paid: status === "verified" ? invoice.total : invoice.amount_paid, status: status === "verified" ? "paid" : invoice.status }, { ...order, status: status === "verified" ? "payment_verified" : order.status, payment_verified_at: status === "verified" ? new Date() : null, provisioning_eligible_at: status === "verified" ? new Date() : null });
      await this.idem.completeIdempotency(client, scope, key, response, paymentRow.id);
      return response;
    });
  }

  async get(user: AuthenticatedPrincipal, paymentId: string) {
    const result = await this.db.query(`SELECT id, invoice_id, order_id, customer_id, payment_reference, provider, amount, currency, status, failure_reason, submitted_at, verified_at, created_at FROM payment_records WHERE id = $1 AND customer_id = $2`, [paymentId, user.userId]);
    if (!result.rows[0]) throw new NotFoundException("Payment not found");
    return result.rows[0];
  }

  async listForInvoice(user: AuthenticatedPrincipal, invoiceId: string) {
    const result = await this.db.query(`SELECT p.id, p.invoice_id, p.order_id, p.payment_reference, p.provider, p.amount, p.currency, p.status, p.failure_reason, p.submitted_at, p.verified_at FROM payment_records p JOIN invoices i ON i.id = p.invoice_id WHERE p.invoice_id = $1 AND p.customer_id = $2 AND i.customer_id = $2 ORDER BY p.created_at ASC`, [invoiceId, user.userId]);
    return { data: result.rows };
  }

  async listForCustomer(user: AuthenticatedPrincipal, query: PaymentListQueryDto) {
    const where = ["p.customer_id = $1"]; const values: unknown[] = [user.userId];
    if (query.status) { values.push(query.status); where.push(`p.status = $${values.length}`); }
    if (query.invoiceId) { values.push(query.invoiceId); where.push(`p.invoice_id = $${values.length}`); }
    const count = await this.db.query<{ count: string }>(`SELECT count(*)::text AS count FROM payment_records p WHERE ${where.join(" AND ")}`, values);
    values.push(query.pageSize, (query.page - 1) * query.pageSize);
    const result = await this.db.query(`SELECT p.id,p.invoice_id,p.order_id,p.payment_reference,p.provider,p.amount,p.currency,p.status,p.failure_reason,p.submitted_at,p.verified_at,p.reversed_at,p.created_at FROM payment_records p WHERE ${where.join(" AND ")} ORDER BY p.submitted_at DESC,p.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    return { data: result.rows, pagination: { page: query.page, pageSize: query.pageSize, total: Number(count.rows[0]?.count ?? 0) } };
  }

  private paymentResponse(payment: Record<string, any>, invoice: Record<string, any>, order: Record<string, any>) {
    return { simulated: true, message: payment.status === "verified" ? "Payment verified in the CloudPilot simulation" : "Simulated payment failed", payment: { id: payment.id, reference: payment.payment_reference, amount: payment.amount, currency: payment.currency, status: payment.status, failureReason: payment.failure_reason, submittedAt: payment.submitted_at, verifiedAt: payment.verified_at }, invoice: { id: invoice.id, status: invoice.status, total: invoice.total, amountPaid: invoice.amount_paid, currency: invoice.currency }, order: { id: order.id, status: order.status, paymentVerifiedAt: order.payment_verified_at ?? null, provisioningEligibleAt: order.provisioning_eligible_at ?? null } };
  }
}
