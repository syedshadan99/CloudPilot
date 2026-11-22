import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { DatabaseService } from "../../database/database.service.js";
import { IdentityService } from "../identity/services/identity.service.js";
import { PricingRepository } from "../pricing/repositories/pricing.repository.js";
import { PricingService } from "../pricing/services/pricing.service.js";
import type { QuoteDto } from "../pricing/dto/pricing.dto.js";
import { evaluateNegotiation } from "./negotiation-engine.js";
import { NegotiationRepository, type OfferRow } from "./negotiation.repository.js";
import type { CounterNegotiationDto, StartNegotiationDto } from "./dto/negotiation.dto.js";
import { isCustomerActionable, isOfferExpired } from "../offers/offer-state-machine.js";

const OFFER_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class NegotiationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repo: NegotiationRepository,
    private readonly pricing: PricingService,
    private readonly pricingRepo: PricingRepository,
    private readonly identity: IdentityService,
    private readonly audit: AuditService,
  ) {}

  async start(user: AuthenticatedPrincipal, dto: StartNegotiationDto, idempotencyKey: string) {
    await this.identity.assertActiveCustomer(user.userId);
    const key = this.requireIdempotencyKey(idempotencyKey);
    const scope = `negotiation:start:${user.userId}:${dto.chatSessionId}`;
    const requestHash = NegotiationRepository.requestHash({ ...dto, actorId: user.userId });
    return this.db.transaction(async (client) => {
      const idem = await this.repo.beginIdempotency(client, scope, key, requestHash, "negotiation");
      if (idem.replay) return idem.response;
      const session = await this.repo.lockSession(client, dto.chatSessionId, user.userId);
      if (!session || session.session_type !== "negotiation") throw new NotFoundException("Negotiation session not found");
      let current = await this.repo.currentOffer(client, session.id, true);
      if (current && isOfferExpired(current.expires_at)) {
        await this.expireLockedOffer(client, current);
        current = undefined;
      }
      if (current) throw new ConflictException("This negotiation already has an active offer; submit a counter request");
      const response = await this.evaluateAndPersist(client, user, session, dto, "start", null, key, scope);
      await this.repo.completeIdempotency(client, scope, key, response, String((response.offer as Record<string, unknown>).id));
      return response;
    });
  }

  async counter(user: AuthenticatedPrincipal, sessionId: string, dto: CounterNegotiationDto, idempotencyKey: string) {
    await this.identity.assertActiveCustomer(user.userId);
    if (dto.requestedDiscountPercent === undefined && dto.requestedPrice === undefined) throw new BadRequestException("A counter request must include a discount percentage or requested price");
    const key = this.requireIdempotencyKey(idempotencyKey);
    const scope = `negotiation:counter:${user.userId}:${sessionId}`;
    const requestHash = NegotiationRepository.requestHash({ ...dto, actorId: user.userId, sessionId });
    const result = await this.db.transaction(async (client) => {
      const idem = await this.repo.beginIdempotency(client, scope, key, requestHash, "negotiation");
      if (idem.replay) return { expired: false as const, response: idem.response ?? {} };
      const session = await this.repo.lockSession(client, sessionId, user.userId);
      if (!session || session.session_type !== "negotiation") throw new NotFoundException("Negotiation session not found");
      const current = await this.repo.currentOffer(client, sessionId, true);
      if (!current) throw new ConflictException("This negotiation has no active offer to counter");
      if (isOfferExpired(current.expires_at)) {
        await this.expireLockedOffer(client, current);
        return { expired: true as const };
      }
      if (!isCustomerActionable(current.status)) throw new ConflictException("This offer is not available for a customer counter request");
      const request = this.quoteRequestFromOffer(current, dto);
      const response = await this.evaluateAndPersist(client, user, session, request, "counter", current, key, scope);
      await this.repo.completeIdempotency(client, scope, key, response, String((response.offer as Record<string, unknown>).id));
      return { expired: false as const, response };
    });
    if (result.expired) throw new ConflictException("The offer has expired; start a new negotiation");
    return result.response;
  }

  async getNegotiation(user: AuthenticatedPrincipal, sessionId: string) {
    return this.db.transaction(async (client) => {
      const session = await this.repo.lockSession(client, sessionId, user.userId);
      if (!session || session.session_type !== "negotiation") throw new NotFoundException("Negotiation session not found");
      let offer = await this.repo.currentOffer(client, sessionId, true);
      if (offer && isOfferExpired(offer.expires_at)) {
        await this.expireLockedOffer(client, offer);
        offer = undefined;
      }
      return { id: session.id, state: offer?.status ?? session.state, offer: offer ? this.publicOffer(offer) : null, attempts: await this.repo.listAttempts(user.userId, sessionId) };
    });
  }

  async history(user: AuthenticatedPrincipal, sessionId: string) {
    const session = await this.db.query<{ id: string; session_type: string }>(
      `SELECT id, session_type FROM chat_sessions WHERE id = $1 AND customer_id = $2`,
      [sessionId, user.userId],
    );
    if (!session.rows[0] || session.rows[0].session_type !== "negotiation") throw new NotFoundException("Negotiation session not found");
    return { negotiationId: sessionId, attempts: await this.repo.listAttempts(user.userId, sessionId) };
  }

  publicOffer(offer: OfferRow) {
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
      pricing: {
        basePrice: offer.base_price,
        discountPercent: offer.discount_percent,
        discountAmount: offer.discount_amount,
        finalPrice: offer.final_price,
        currency: offer.currency,
      },
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

  private async evaluateAndPersist(client: PoolClient, user: AuthenticatedPrincipal, session: NonNullable<Awaited<ReturnType<NegotiationRepository["lockSession"]>>>, dto: StartNegotiationDto, requestKind: "start" | "counter", parentOffer: OfferRow | null, idempotencyKey: string, scope: string) {
    const quoteDto = this.toQuoteDto(dto, session);
    const quote = await this.pricing.authoritativeQuote(quoteDto, client);
    if (!quote.availability.available) throw new ConflictException("The requested VM configuration is not currently available");
    const version = await this.pricingRepo.findVersion(quote.pricingVersion.id, quote.configuration.organizationId as string, client);
    const policy = await this.pricingRepo.effectivePolicy(quote.configuration.organizationId as string, new Date(), client);
    if (!version || !policy || policy.organization_id !== quote.configuration.organizationId) throw new ConflictException("No consistent active pricing and negotiation policy is available");
    const rules = version.rules.filter((rule) => rule.vm_template_id === (quote.configuration.templateId as string | null) || rule.vm_template_id === null);
    const decision = evaluateNegotiation(quote.baseTotal, quote.currency, policy, rules, dto);
    const attemptNumber = await this.repo.nextAttemptNumber(client, session.id);
    if (attemptNumber > policy.maximum_attempts) throw new ConflictException("The maximum number of negotiation attempts has been reached");
    const requestSnapshot = this.safeRequestSnapshot(dto, requestKind);
    const attempt = await this.repo.createAttempt(client, {
      chatSessionId: session.id,
      customerId: user.userId,
      attemptNumber,
      requestKind,
      requestedDiscountPercent: decision.requestedDiscountPercent,
      requestedPrice: decision.requestedPrice,
      outcome: decision.outcome,
      reason: dto.reason ?? decision.reason,
      requestSnapshot,
      decisionSnapshot: { ...decision, pricingVersionId: version.version.id, negotiationPolicyId: policy.id },
    });
    const status = decision.requiresApproval ? "pending_provider_review" : "presented";
    if (parentOffer) await this.repo.supersedeOffer(client, parentOffer, user.userId, "Customer submitted a newer counter request");
    const offer = await this.repo.insertOffer(client, {
      customerId: user.userId,
      organizationId: quote.configuration.organizationId as string,
      chatSessionId: session.id,
      pricingVersionId: version.version.id,
      negotiationPolicyId: policy.id,
      vmTemplateId: quote.configuration.templateId as string | null,
      configuration: quote.configuration,
      basePrice: decision.basePrice,
      discountPercent: decision.discountPercent,
      discountAmount: decision.discountAmount,
      finalPrice: decision.finalPrice,
      currency: decision.currency,
      billingCycle: quote.billingCycle,
      rentalDurationDays: quote.rentalDurationDays,
      status,
      reviewReason: decision.requiresApproval ? dto.reason ?? decision.reason : null,
      expiresAt: new Date(Date.now() + OFFER_TTL_MS),
      actorId: user.userId,
      parentOfferId: parentOffer?.id ?? null,
      attemptId: attempt.id,
      commercialSnapshot: {
        pricingVersion: version.version,
        negotiationPolicy: { id: policy.id, name: policy.name, maximumDiscountPercent: policy.maximum_discount_percent, minimumPrice: policy.minimum_price, approvalThreshold: policy.approval_threshold, maximumAttempts: policy.maximum_attempts, effectiveFrom: policy.effective_from, effectiveTo: policy.effective_to },
        pricingRuleIds: rules.map((rule) => rule.id),
        decision,
      },
    });
    const response = {
      negotiationId: session.id,
      outcome: decision.counteroffer ? "countered" : decision.outcome,
      attempt: attempt.attempt_number,
      decision: { requestedDiscountPercent: decision.requestedDiscountPercent, requestedPrice: decision.requestedPrice, discountPercent: decision.discountPercent, discountAmount: decision.discountAmount, finalPrice: decision.finalPrice, basePrice: decision.basePrice, currency: decision.currency, requiresApproval: decision.requiresApproval, reason: decision.reason },
      offer: this.publicOffer(offer),
    };
    await this.audit.record({ actorId: user.userId, organizationId: offer.organization_id, action: requestKind === "start" ? "negotiation.initiated" : "negotiation.counter_submitted", entityType: "offer", entityId: offer.id, newData: { attempt: attempt.attempt_number, decision: response.decision }, reason: dto.reason }, client);
    return response;
  }

  private toQuoteDto(dto: StartNegotiationDto, session: NonNullable<Awaited<ReturnType<NegotiationRepository["lockSession"]>>>): QuoteDto {
    const r = session.requirements;
    const result = {
      templateId: dto.templateId,
      organizationId: dto.organizationId,
      cpuCores: dto.cpuCores ?? r?.cpu_cores,
      ramGb: dto.ramGb ?? r?.ram_gb,
      storageGb: dto.storageGb ?? r?.storage_gb,
      storageType: dto.storageType ?? "ssd",
      operatingSystem: dto.operatingSystem ?? r?.os,
      bandwidthMbps: dto.bandwidthMbps ?? 100,
      region: dto.region ?? "simulated-1",
      billingCycle: dto.billingCycle ?? r?.billing_cycle,
      rentalDurationDays: dto.rentalDurationDays ?? r?.duration_days,
    };
    if (!result.billingCycle || !result.rentalDurationDays) throw new BadRequestException("Billing cycle and rental duration are required");
    if (!result.templateId && (!result.organizationId || !result.cpuCores || !result.ramGb || !result.storageGb || !result.operatingSystem)) throw new BadRequestException("A template or complete custom VM configuration is required");
    return result as QuoteDto;
  }

  private quoteRequestFromOffer(offer: OfferRow, dto: CounterNegotiationDto): StartNegotiationDto {
    const config = offer.vm_configuration;
    return {
      chatSessionId: offer.chat_session_id,
      templateId: offer.vm_template_id ?? undefined,
      organizationId: offer.organization_id,
      cpuCores: Number(config.cpuCores),
      ramGb: Number(config.ramGb),
      storageGb: Number(config.storageGb),
      storageType: String(config.storageType ?? "ssd"),
      operatingSystem: String(config.operatingSystem ?? "linux"),
      bandwidthMbps: Number(config.bandwidthMbps ?? 100),
      region: String(config.region ?? "simulated-1"),
      billingCycle: offer.billing_cycle,
      rentalDurationDays: offer.rental_duration_days,
      requestedDiscountPercent: dto.requestedDiscountPercent,
      requestedPrice: dto.requestedPrice,
      reason: dto.reason,
    };
  }

  private safeRequestSnapshot(dto: StartNegotiationDto, requestKind: string): Record<string, unknown> {
    return { requestKind, templateId: dto.templateId, organizationId: dto.organizationId, cpuCores: dto.cpuCores, ramGb: dto.ramGb, storageGb: dto.storageGb, storageType: dto.storageType, operatingSystem: dto.operatingSystem, bandwidthMbps: dto.bandwidthMbps, region: dto.region, billingCycle: dto.billingCycle, rentalDurationDays: dto.rentalDurationDays, requestedDiscountPercent: dto.requestedDiscountPercent, requestedPrice: dto.requestedPrice, reason: dto.reason };
  }

  private async expireLockedOffer(client: PoolClient, offer: OfferRow): Promise<void> {
    await this.repo.transitionOffer(client, offer, null, "expired", "offer_expired", "Offer expiry deadline reached");
  }

  private requireIdempotencyKey(value: string | undefined): string {
    if (!value || value.trim().length < 8 || value.trim().length > 200) throw new BadRequestException("A valid Idempotency-Key header is required");
    return value.trim();
  }

}
