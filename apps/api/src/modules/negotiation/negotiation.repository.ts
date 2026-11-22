import { ConflictException, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
import { DatabaseService } from "../../database/database.service.js";

export interface NegotiationSessionRow {
  id: string;
  customer_id: string;
  state: string;
  session_type: string;
  active_offer_id: string | null;
  title: string | null;
  requirements: {
    cpu_cores: number | null;
    ram_gb: number | null;
    storage_gb: number | null;
    os: string | null;
    duration_days: number | null;
    billing_cycle: "hourly" | "daily" | "monthly" | null;
    use_case: string | null;
    notes: string | null;
  } | null;
}

export interface OfferRow {
  id: string;
  customer_id: string;
  organization_id: string;
  organization_name?: string;
  chat_session_id: string;
  pricing_version_id: string;
  negotiation_policy_id: string;
  vm_template_id: string | null;
  vm_configuration: Record<string, unknown>;
  base_price: string;
  discount_percent: string;
  discount_amount: string;
  final_price: string;
  currency: string;
  billing_cycle: "hourly" | "daily" | "monthly";
  rental_duration_days: number;
  status: string;
  provider_review_reason: string | null;
  presented_at: Date | null;
  expires_at: Date | null;
  accepted_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  parent_offer_id: string | null;
  negotiation_attempt_id: string | null;
  commercial_snapshot: Record<string, unknown>;
}

export interface AttemptRow {
  id: string;
  chat_session_id: string;
  attempt_number: number;
  request_kind: string;
  requested_discount_percent: string | null;
  requested_price: string | null;
  outcome: string;
  reason: string | null;
  request_snapshot: Record<string, unknown>;
  decision_snapshot: Record<string, unknown>;
  offer_id: string | null;
  created_at: Date;
}

export interface IdempotencyReplay {
  replay: boolean;
  response: Record<string, unknown> | null;
}

const offerColumns = `o.id, o.customer_id, o.organization_id, o.chat_session_id,
  o.pricing_version_id, o.negotiation_policy_id, o.vm_template_id,
  o.vm_configuration, o.base_price, o.discount_percent, o.discount_amount,
  o.final_price, o.currency, o.billing_cycle, o.rental_duration_days, o.status,
  o.provider_review_reason, o.presented_at, o.expires_at, o.accepted_at,
  o.created_by, o.created_at, o.updated_at, o.parent_offer_id,
  o.negotiation_attempt_id, o.commercial_snapshot`;

@Injectable()
export class NegotiationRepository {
  constructor(private readonly db: DatabaseService) {}

  static requestHash(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  async beginIdempotency(client: PoolClient, scope: string, key: string, requestHash: string, resourceType: string): Promise<IdempotencyReplay> {
    await client.query(
      `INSERT INTO idempotency_keys (scope, idempotency_key, request_hash, resource_type, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')
       ON CONFLICT (scope, idempotency_key) DO NOTHING`,
      [scope, key, requestHash, resourceType],
    );
    const result = await client.query<{ request_hash: string; status: string; response_body: Record<string, unknown> | null }>(
      `SELECT request_hash, status, response_body FROM idempotency_keys
       WHERE scope = $1 AND idempotency_key = $2 FOR UPDATE`,
      [scope, key],
    );
    const row = result.rows[0]!;
    if (row.request_hash !== requestHash) throw new ConflictException("Idempotency key was already used with different request data");
    if (row.status === "succeeded") return { replay: true, response: row.response_body };
    if (row.status === "in_progress") return { replay: false, response: null };
    throw new ConflictException("This idempotent command cannot be retried");
  }

  async completeIdempotency(client: PoolClient, scope: string, key: string, response: Record<string, unknown>, resourceId: string): Promise<void> {
    await client.query(
      `UPDATE idempotency_keys SET status = 'succeeded', response_status = 200,
              response_body = $3::jsonb, resource_id = $4, updated_at = NOW()
       WHERE scope = $1 AND idempotency_key = $2`,
      [scope, key, JSON.stringify(response), resourceId],
    );
  }

  async lockSession(client: PoolClient, sessionId: string, customerId: string): Promise<NegotiationSessionRow | undefined> {
    const session = await client.query<Omit<NegotiationSessionRow, "requirements">>(
      `SELECT id, customer_id, state, session_type, active_offer_id, title
       FROM chat_sessions WHERE id = $1 AND customer_id = $2 FOR UPDATE`,
      [sessionId, customerId],
    );
    if (!session.rows[0]) return undefined;
    const requirements = await client.query<NonNullable<NegotiationSessionRow["requirements"]>>(
      `SELECT cpu_cores, ram_gb, storage_gb, os, duration_days, billing_cycle, use_case, notes
       FROM vm_requirements WHERE session_id = $1`,
      [sessionId],
    );
    return { ...session.rows[0], requirements: requirements.rows[0] ?? null };
  }

  async currentOffer(client: PoolClient, sessionId: string, lock = false): Promise<OfferRow | undefined> {
    const result = await client.query<OfferRow>(
      `SELECT ${offerColumns} FROM offers o
       WHERE o.chat_session_id = $1 AND o.status IN ('presented', 'pending_provider_review', 'approved')
       ORDER BY o.created_at DESC, o.id DESC LIMIT 1${lock ? " FOR UPDATE" : ""}`,
      [sessionId],
    );
    return result.rows[0];
  }

  async lockOfferForCustomer(client: PoolClient, offerId: string, customerId: string): Promise<OfferRow | undefined> {
    const result = await client.query<OfferRow>(
      `SELECT ${offerColumns} FROM offers o WHERE o.id = $1 AND o.customer_id = $2 FOR UPDATE`,
      [offerId, customerId],
    );
    return result.rows[0];
  }

  async lockOfferForProvider(client: PoolClient, offerId: string, organizationId: string): Promise<OfferRow | undefined> {
    const result = await client.query<OfferRow>(
      `SELECT ${offerColumns} FROM offers o WHERE o.id = $1 AND o.organization_id = $2 FOR UPDATE`,
      [offerId, organizationId],
    );
    return result.rows[0];
  }

  async createAttempt(client: PoolClient, input: {
    chatSessionId: string;
    customerId: string;
    attemptNumber: number;
    requestKind: "start" | "counter";
    requestedDiscountPercent: string | null;
    requestedPrice: string | null;
    outcome: string;
    reason: string;
    requestSnapshot: Record<string, unknown>;
    decisionSnapshot: Record<string, unknown>;
  }): Promise<AttemptRow> {
    const result = await client.query<AttemptRow>(
      `INSERT INTO negotiation_attempts
         (chat_session_id, customer_id, attempt_number, request_kind,
          requested_discount_percent, requested_price, outcome, reason,
          request_snapshot, decision_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
       RETURNING *`,
      [input.chatSessionId, input.customerId, input.attemptNumber, input.requestKind,
        input.requestedDiscountPercent, input.requestedPrice, input.outcome, input.reason,
        JSON.stringify(input.requestSnapshot), JSON.stringify(input.decisionSnapshot)],
    );
    return result.rows[0]!;
  }

  async linkAttemptToOffer(client: PoolClient, attemptId: string, offerId: string): Promise<void> {
    await client.query(`UPDATE negotiation_attempts SET offer_id = $2 WHERE id = $1`, [attemptId, offerId]);
  }

  async nextAttemptNumber(client: PoolClient, sessionId: string): Promise<number> {
    const result = await client.query<{ next_number: number }>(
      `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_number
       FROM negotiation_attempts WHERE chat_session_id = $1`,
      [sessionId],
    );
    return Number(result.rows[0]?.next_number ?? 1);
  }

  async insertOffer(client: PoolClient, input: {
    customerId: string;
    organizationId: string;
    chatSessionId: string;
    pricingVersionId: string;
    negotiationPolicyId: string;
    vmTemplateId: string | null;
    configuration: Record<string, unknown>;
    basePrice: string;
    discountPercent: string;
    discountAmount: string;
    finalPrice: string;
    currency: string;
    billingCycle: string;
    rentalDurationDays: number;
    status: string;
    reviewReason: string | null;
    expiresAt: Date;
    actorId: string;
    parentOfferId: string | null;
    attemptId: string;
    commercialSnapshot: Record<string, unknown>;
  }): Promise<OfferRow> {
    const result = await client.query<OfferRow>(
      `INSERT INTO offers
       (customer_id, organization_id, chat_session_id, pricing_version_id,
        negotiation_policy_id, vm_template_id, vm_configuration, base_price,
        discount_percent, discount_amount, final_price, currency, billing_cycle,
        rental_duration_days, status, provider_review_reason, presented_at,
        expires_at, created_by, parent_offer_id, negotiation_attempt_id,
        commercial_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),$17,$18,$19,$20,$21::jsonb)
       RETURNING *`,
      [input.customerId, input.organizationId, input.chatSessionId, input.pricingVersionId,
        input.negotiationPolicyId, input.vmTemplateId, JSON.stringify(input.configuration),
        input.basePrice, input.discountPercent, input.discountAmount, input.finalPrice,
        input.currency, input.billingCycle, input.rentalDurationDays, input.status,
        input.reviewReason, input.expiresAt, input.actorId, input.parentOfferId,
        input.attemptId, JSON.stringify(input.commercialSnapshot)],
    );
    const offer = result.rows[0]!;
    await client.query(
      `INSERT INTO offer_events (offer_id, actor_id, from_status, to_status, event_type, reason, metadata)
       VALUES ($1,$2,NULL,$3,'offer_created',$4,$5::jsonb)`,
      [offer.id, input.actorId, input.status, input.reviewReason, JSON.stringify({ parentOfferId: input.parentOfferId, attemptId: input.attemptId })],
    );
    await this.linkAttemptToOffer(client, input.attemptId, offer.id);
    await client.query(`UPDATE chat_sessions SET active_offer_id = $2, state = $3, updated_at = NOW() WHERE id = $1`, [input.chatSessionId, offer.id, input.status === "pending_provider_review" ? "ESCALATED" : "CUSTOMER_REVIEW"]);
    return offer;
  }

  async supersedeOffer(client: PoolClient, offer: OfferRow, actorId: string, reason: string): Promise<void> {
    await client.query(`UPDATE offers SET status = 'countered', updated_at = NOW() WHERE id = $1 AND status IN ('presented','pending_provider_review','approved')`, [offer.id]);
    await this.event(client, offer.id, actorId, offer.status, "countered", "offer_superseded", reason, { successor: true });
  }

  async transitionOffer(client: PoolClient, offer: OfferRow, actorId: string | null, toStatus: string, eventType: string, reason: string | null, metadata: Record<string, unknown> = {}): Promise<OfferRow> {
    const result = await client.query<OfferRow>(
      `UPDATE offers SET status = $2, updated_at = NOW(),
              accepted_at = CASE WHEN $2 = 'accepted' THEN NOW() ELSE accepted_at END
       WHERE id = $1 RETURNING *`,
      [offer.id, toStatus],
    );
    const updated = result.rows[0]!;
    await this.event(client, offer.id, actorId, offer.status, toStatus, eventType, reason, metadata);
    if (toStatus === "expired" || toStatus === "declined" || toStatus === "rejected" || toStatus === "cancelled") {
      await client.query(`UPDATE chat_sessions SET active_offer_id = NULL, state = $2, updated_at = NOW() WHERE id = $1 AND active_offer_id = $3`, [offer.chat_session_id, toStatus === "expired" ? "EXPIRED" : toStatus === "declined" ? "CANCELLED" : toStatus === "rejected" ? "REJECTED" : "CANCELLED", offer.id]);
    }
    return updated;
  }

  async insertApproval(client: PoolClient, offerId: string, reviewerId: string, decision: "approved" | "rejected", reason: string): Promise<void> {
    await client.query(
      `INSERT INTO offer_approvals (offer_id, reviewer_id, decision, reason, decided_at)
       VALUES ($1,$2,$3,$4,NOW())`,
      [offerId, reviewerId, decision, reason],
    );
  }

  async event(client: PoolClient, offerId: string, actorId: string | null, fromStatus: string | null, toStatus: string, eventType: string, reason: string | null, metadata: Record<string, unknown> = {}): Promise<void> {
    await client.query(
      `INSERT INTO offer_events (offer_id, actor_id, from_status, to_status, event_type, reason, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [offerId, actorId, fromStatus, toStatus, eventType, reason, JSON.stringify(metadata)],
    );
  }

  async listOffers(customerId: string, page: number, pageSize: number, status?: string, chatSessionId?: string) {
    const values: unknown[] = [customerId];
    const filters = ["o.customer_id = $1"];
    if (status) { values.push(status); filters.push(`o.status = $${values.length}`); }
    if (chatSessionId) { values.push(chatSessionId); filters.push(`o.chat_session_id = $${values.length}`); }
    const count = await this.db.query<{ count: string }>(`SELECT count(*)::text AS count FROM offers o WHERE ${filters.join(" AND ")}`, values);
    values.push(pageSize, (page - 1) * pageSize);
    const rows = await this.db.query<OfferRow>(`SELECT ${offerColumns}, org.name AS organization_name FROM offers o JOIN organizations org ON org.id = o.organization_id WHERE ${filters.join(" AND ")} ORDER BY o.created_at DESC, o.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    return { rows: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
  }

  async findOffer(customerId: string, offerId: string): Promise<OfferRow | undefined> {
    const result = await this.db.query<OfferRow>(`SELECT ${offerColumns}, org.name AS organization_name FROM offers o JOIN organizations org ON org.id = o.organization_id WHERE o.id = $1 AND o.customer_id = $2`, [offerId, customerId]);
    return result.rows[0];
  }

  async listEvents(offerId: string, customerId?: string, organizationId?: string) {
    const values: unknown[] = [offerId];
    const scope = customerId ? "AND o.customer_id = $2" : organizationId ? "AND o.organization_id = $2" : "";
    if (customerId ?? organizationId) values.push(customerId ?? organizationId);
    const result = await this.db.query(`SELECT e.id, e.actor_id, e.from_status, e.to_status, e.event_type, e.reason, e.metadata, e.created_at FROM offer_events e JOIN offers o ON o.id = e.offer_id WHERE e.offer_id = $1 ${scope} ORDER BY e.created_at ASC, e.id ASC`, values);
    return result.rows;
  }

  async listAttempts(customerId: string, sessionId: string) {
    const result = await this.db.query<AttemptRow>(`SELECT * FROM negotiation_attempts WHERE customer_id = $1 AND chat_session_id = $2 ORDER BY attempt_number ASC`, [customerId, sessionId]);
    return result.rows;
  }

  async providerQueue(organizationId: string, page: number, pageSize: number) {
    const count = await this.db.query<{ count: string }>(`SELECT count(*)::text AS count FROM offers WHERE organization_id = $1 AND status = 'pending_provider_review'`, [organizationId]);
    const rows = await this.db.query<OfferRow>(`SELECT ${offerColumns}, org.name AS organization_name FROM offers o JOIN organizations org ON org.id = o.organization_id WHERE o.organization_id = $1 AND o.status = 'pending_provider_review' ORDER BY o.created_at ASC, o.id ASC LIMIT $2 OFFSET $3`, [organizationId, pageSize, (page - 1) * pageSize]);
    return { rows: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
  }

  async expiryBatch(limit: number): Promise<number> {
    return this.db.transaction(async (client) => {
      const candidates = await client.query<OfferRow>(
        `SELECT ${offerColumns} FROM offers o
         WHERE o.status IN ('presented','pending_provider_review','approved')
           AND o.expires_at IS NOT NULL AND o.expires_at <= NOW()
         ORDER BY o.expires_at ASC, o.id ASC
         FOR UPDATE SKIP LOCKED LIMIT $1`,
        [limit],
      );
      let processed = 0;
      for (const offer of candidates.rows) {
        const result = await client.query<OfferRow>(
          `UPDATE offers SET status = 'expired', updated_at = NOW()
           WHERE id = $1 AND status IN ('presented','pending_provider_review','approved')
             AND expires_at <= NOW() RETURNING *`,
          [offer.id],
        );
        if (!result.rowCount) continue;
        await this.event(client, offer.id, null, offer.status, "expired", "offer_expired", "Offer expiry deadline reached", {});
        await client.query(`UPDATE chat_sessions SET active_offer_id = NULL, state = 'EXPIRED', updated_at = NOW() WHERE id = $1 AND active_offer_id = $2`, [offer.chat_session_id, offer.id]);
        processed += 1;
      }
      return processed;
    });
  }
}
