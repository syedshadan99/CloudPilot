import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { DatabaseService } from "../../database/database.service.js";
import { AuthorizationService } from "../identity/services/authorization.service.js";
import { NegotiationRepository, type OfferRow } from "../negotiation/negotiation.repository.js";
import { assertOfferTransition, isCustomerActionable, isExpirable, isOfferExpired } from "./offer-state-machine.js";

@Injectable()
export class OffersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repo: NegotiationRepository,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async listCustomerOffers(user: AuthenticatedPrincipal, page: number, pageSize: number, status?: string, chatSessionId?: string) {
    await this.repo.expiryBatch(100);
    const result = await this.repo.listOffers(user.userId, page, pageSize, status, chatSessionId);
    return { data: result.rows.map((row) => this.publicOffer(row)), pagination: { page, pageSize, total: result.total } };
  }

  async getCustomerOffer(user: AuthenticatedPrincipal, offerId: string) {
    const result = await this.db.transaction(async (client) => {
      const offer = await this.repo.lockOfferForCustomer(client, offerId, user.userId);
      if (!offer) throw new NotFoundException("Offer not found");
      if (isOfferExpired(offer.expires_at) && isExpirable(offer.status)) {
        return this.publicOffer(await this.expire(client, offer));
      }
      return this.publicOffer(offer);
    });
    return result;
  }

  async offerEvents(user: AuthenticatedPrincipal, offerId: string) {
    const offer = await this.repo.findOffer(user.userId, offerId);
    if (!offer) throw new NotFoundException("Offer not found");
    return { offerId, data: await this.repo.listEvents(offerId, user.userId) };
  }

  async decline(user: AuthenticatedPrincipal, offerId: string, reason: string | undefined, idempotencyKey: string) {
    const key = this.requireIdempotencyKey(idempotencyKey);
    const scope = `offer:decline:${user.userId}:${offerId}`;
    const requestHash = NegotiationRepository.requestHash({ offerId, reason, actorId: user.userId });
    const result = await this.db.transaction(async (client) => {
      const idem = await this.repo.beginIdempotency(client, scope, key, requestHash, "offer");
      if (idem.replay) return { expired: false as const, response: idem.response ?? {} };
      const offer = await this.repo.lockOfferForCustomer(client, offerId, user.userId);
      if (!offer) throw new NotFoundException("Offer not found");
      if (isOfferExpired(offer.expires_at) && isExpirable(offer.status)) {
        await this.expire(client, offer);
        return { expired: true as const };
      }
      if (offer.status === "declined") {
        const response = { offer: this.publicOffer(offer), declined: true };
        await this.repo.completeIdempotency(client, scope, key, response, offer.id);
        return { expired: false as const, response };
      }
      if (!isCustomerActionable(offer.status)) throw new ConflictException("Only a currently actionable offer can be declined");
      assertOfferTransition(offer.status, "declined");
      const updated = await this.repo.transitionOffer(client, offer, user.userId, "declined", "customer_declined", reason ?? "Customer declined the offer");
      await this.audit.record({ actorId: user.userId, organizationId: offer.organization_id, action: "offer.declined", entityType: "offer", entityId: offer.id, oldData: { status: offer.status }, newData: { status: updated.status }, reason }, client);
      const response = { offer: this.publicOffer(updated), declined: true };
      await this.repo.completeIdempotency(client, scope, key, response, offer.id);
      return { expired: false as const, response };
    });
    if (result.expired) throw new ConflictException("The offer has expired");
    return result.response;
  }

  async providerQueue(user: AuthenticatedPrincipal, organizationId: string, page: number, pageSize: number) {
    await this.assertProviderMember(user, organizationId);
    await this.repo.expiryBatch(100);
    const result = await this.repo.providerQueue(organizationId, page, pageSize);
    return { data: result.rows.map((row) => this.providerOffer(row)), pagination: { page, pageSize, total: result.total } };
  }

  async providerDecision(user: AuthenticatedPrincipal, offerId: string, organizationId: string, decision: "approved" | "rejected", reason: string, idempotencyKey: string) {
    await this.assertProviderMember(user, organizationId);
    const key = this.requireIdempotencyKey(idempotencyKey);
    const scope = `offer:provider-decision:${user.userId}:${offerId}`;
    const requestHash = NegotiationRepository.requestHash({ offerId, organizationId, decision, reason, actorId: user.userId });
    const result = await this.db.transaction(async (client) => {
      const idem = await this.repo.beginIdempotency(client, scope, key, requestHash, "offer");
      if (idem.replay) return { expired: false as const, response: idem.response ?? {} };
      const offer = await this.repo.lockOfferForProvider(client, offerId, organizationId);
      if (!offer) throw new NotFoundException("Offer not found");
      if (isOfferExpired(offer.expires_at) && offer.status === "pending_provider_review") {
        await this.expire(client, offer);
        return { expired: true as const };
      }
      if (offer.status !== "pending_provider_review") throw new ConflictException("This offer is not awaiting provider review");
      const nextStatus = decision === "approved" ? "approved" : "rejected";
      assertOfferTransition(offer.status, nextStatus);
      await this.repo.insertApproval(client, offer.id, user.userId, decision, reason);
      const updated = await this.repo.transitionOffer(client, offer, user.userId, nextStatus, `provider_${decision}`, reason);
      await this.audit.record({ actorId: user.userId, organizationId, action: `offer.provider_${decision}`, entityType: "offer", entityId: offer.id, oldData: { status: offer.status }, newData: { status: updated.status }, reason }, client);
      const response = { offer: this.providerOffer(updated), decision, decidedAt: new Date().toISOString() };
      await this.repo.completeIdempotency(client, scope, key, response, offer.id);
      return { expired: false as const, response };
    });
    if (result.expired) throw new ConflictException("The offer has expired and cannot be reviewed");
    return result.response;
  }

  /**
   * CP-06 contract: call this inside its order/invoice transaction. It locks
   * the offer and verifies every offer-side precondition without accepting it.
   */
  async assertAcceptanceEligibility(client: PoolClient, customerId: string, offerId: string): Promise<OfferRow> {
    const offer = await this.repo.lockOfferForCustomer(client, offerId, customerId);
    if (!offer) throw new NotFoundException("Offer not found");
    if (isOfferExpired(offer.expires_at)) {
      if (isExpirable(offer.status)) await this.expire(client, offer);
      throw new ConflictException("Offer has expired");
    }
    if (!isCustomerActionable(offer.status)) throw new ConflictException("Offer is not eligible for acceptance");
    const approval = await client.query<{ decision: string }>(`SELECT decision FROM offer_approvals WHERE offer_id = $1 ORDER BY created_at DESC LIMIT 1`, [offer.id]);
    if (offer.status === "approved" && approval.rows[0]?.decision !== "approved") throw new ConflictException("Provider approval is missing");
    const existingOrder = await client.query(`SELECT 1 FROM orders WHERE offer_id = $1`, [offer.id]);
    if (existingOrder.rowCount) throw new ConflictException("An order already exists for this offer");
    if (!offer.pricing_version_id || !offer.negotiation_policy_id || !offer.currency) throw new ConflictException("Offer commercial snapshot is incomplete");
    return offer;
  }

  async processExpiryBatch(limit = 100): Promise<number> {
    return this.repo.expiryBatch(Math.min(Math.max(limit, 1), 500));
  }

  private async expire(client: PoolClient, offer: OfferRow): Promise<OfferRow> {
    assertOfferTransition(offer.status, "expired");
    return this.repo.transitionOffer(client, offer, null, "expired", "offer_expired", "Offer expiry deadline reached");
  }

  private async assertProviderMember(user: AuthenticatedPrincipal, organizationId: string): Promise<void> {
    if (user.role !== "provider_admin" && user.role !== "provider_staff") throw new ForbiddenException("Provider role required");
    await this.authorization.assertOrganizationMember(user.userId, organizationId);
  }

  private publicOffer(offer: OfferRow) {
    return {
      id: offer.id,
      customerId: offer.customer_id,
      provider: { organizationId: offer.organization_id, name: offer.organization_name ?? undefined },
      chatSessionId: offer.chat_session_id,
      pricingVersionId: offer.pricing_version_id,
      negotiationPolicyId: offer.negotiation_policy_id,
      parentOfferId: offer.parent_offer_id,
      vmTemplateId: offer.vm_template_id,
      configuration: offer.vm_configuration,
      pricing: { basePrice: offer.base_price, discountPercent: offer.discount_percent, discountAmount: offer.discount_amount, finalPrice: offer.final_price, currency: offer.currency },
      billingCycle: offer.billing_cycle,
      rentalDurationDays: offer.rental_duration_days,
      status: offer.status,
      providerReviewReason: offer.provider_review_reason,
      presentedAt: offer.presented_at,
      expiresAt: offer.expires_at,
      actionable: isCustomerActionable(offer.status) && !isOfferExpired(offer.expires_at),
      createdAt: offer.created_at,
      updatedAt: offer.updated_at,
    };
  }

  private providerOffer(offer: OfferRow) {
    return { ...this.publicOffer(offer), customerId: offer.customer_id, commercialSnapshot: offer.commercial_snapshot };
  }

  private requireIdempotencyKey(value: string | undefined): string {
    if (!value || value.trim().length < 8 || value.trim().length > 200) throw new ConflictException("A valid Idempotency-Key header is required");
    return value.trim();
  }
}
