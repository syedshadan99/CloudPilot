import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { DatabaseService } from "../../database/database.service.js";
import { AuthorizationService } from "../identity/services/authorization.service.js";
import { PricingRepository } from "../pricing/repositories/pricing.repository.js";
import { formatMoney, parseMoney } from "../pricing/services/money.js";
import { evaluateNegotiation } from "../negotiation/negotiation-engine.js";
import { assertOfferTransition } from "../offers/offer-state-machine.js";
import type { ProviderOverrideDto, ProviderReportQueryDto } from "./dto/provider.dto.js";
import { validateProviderReportWindow } from "./report-window.js";
import { ProviderRepository } from "./provider.repository.js";

@Injectable()
export class ProviderService {
  constructor(
    private readonly repo: ProviderRepository,
    private readonly authorization: AuthorizationService,
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly pricing: PricingRepository,
  ) {}

  async dashboard(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query.organizationId);
    this.validateWindow(query);
    const [counts, finances, activity] = await Promise.all([
      this.repo.dashboardCounts(query.organizationId, query),
      this.repo.financialSummary(query.organizationId, query),
      this.repo.activity(query.organizationId, query, 1, 10),
    ]);
    return {
      organizationId: query.organizationId,
      metrics: {
        totalCustomers: Number(counts.total_customers),
        activeVirtualMachines: Number(counts.active_vms),
        pendingDealReviews: Number(counts.pending_deal_reviews),
        acceptedOffers: Number(counts.accepted_offers),
        completedOrders: Number(counts.completed_orders),
        failedProvisioningJobs: Number(counts.failed_provisioning_jobs),
        issuedInitialInvoices: Number(counts.issued_initial_invoices),
        overdueInvoiceCount: finances.reduce((total, group) => total + group.overdueInvoiceCount, 0),
        averageAcceptedDiscountPercent: counts.average_accepted_discount,
      },
      financialsByCurrency: finances,
      recentActivity: activity.rows,
      window: this.windowResponse(query),
      limitations: [
        "Financial totals are grouped by currency and use provider-attributed invoice components; void invoices contribute zero financial amounts.",
        "Verified simulated payments are reported only for invoices attributable to one provider; shared recurring invoices are not assigned payment settlement to a provider.",
        "Margin estimates are unavailable because no approved provider cost basis exists.",
      ],
    };
  }

  async listCustomers(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query.organizationId);
    this.validateWindow(query);
    const result = await this.repo.listCustomers(query.organizationId, query, query.page, query.pageSize);
    return { data: result.rows.map((row) => this.publicCustomer(row)), pagination: this.pagination(query, result.total) };
  }

  async getCustomer(user: AuthenticatedPrincipal, organizationId: string, customerId: string) {
    await this.assertMember(user, organizationId);
    const result = await this.repo.getCustomer(organizationId, customerId);
    if (!result) throw new NotFoundException("Customer relationship not found");
    return {
      ...this.publicCustomer(result.customer),
      deals: result.deals.map((row) => this.publicDeal(row)),
      orders: result.orders,
      vms: result.vms,
    };
  }

  async listDeals(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query.organizationId);
    this.validateWindow(query);
    const result = await this.repo.listDeals(query.organizationId, query, query.page, query.pageSize);
    return { data: result.rows.map((row) => this.publicDeal(row)), pagination: this.pagination(query, result.total) };
  }

  async getDeal(user: AuthenticatedPrincipal, organizationId: string, offerId: string) {
    await this.assertMember(user, organizationId);
    const deal = await this.repo.getDeal(organizationId, offerId);
    if (!deal) throw new NotFoundException("Deal not found");
    const evidence = await this.repo.getDealEvidence(organizationId, offerId);
    return { deal: this.publicDeal(deal), evidence, marginEstimate: null };
  }

  async listOrders(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query.organizationId);
    this.validateWindow(query);
    const result = await this.repo.listOrders(query.organizationId, query, query.page, query.pageSize);
    return { data: result.rows, pagination: this.pagination(query, result.total) };
  }

  async listVms(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query.organizationId);
    this.validateWindow(query);
    const result = await this.repo.listVms(query.organizationId, query, query.page, query.pageSize);
    return { data: result.rows, pagination: this.pagination(query, result.total) };
  }

  async listInvoices(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query.organizationId);
    this.validateWindow(query);
    const result = await this.repo.invoiceAllocations(query.organizationId, query, query.page, query.pageSize);
    return {
      data: result.rows,
      pagination: this.pagination(query, result.total),
      financialSemantics: {
        providerAmount: "Initial and single-provider invoices use the attributable invoice header. Shared recurring invoice totals, including persisted adjustments, are allocated proportionally to provider-owned charge lines.",
        outstandingAmount: "For shared recurring invoices, the outstanding header balance is allocated proportionally to provider charge lines; void and uncollectible balances are not receivables.",
        verifiedSimulatedPayments: "Shared invoices return zero provider payment allocation because payment settlement allocation is not persisted.",
      },
    };
  }

  async pricingHistory(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query.organizationId);
    const result = await this.repo.listPricing(query.organizationId, query.page, query.pageSize);
    return { data: result.rows, pagination: this.pagination(query, result.total) };
  }

  async pricingVersion(user: AuthenticatedPrincipal, organizationId: string, versionId: string) {
    await this.assertMember(user, organizationId);
    const version = await this.repo.getPricing(organizationId, versionId);
    if (!version) throw new NotFoundException("Pricing version not found");
    return version;
  }

  async activity(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query.organizationId);
    this.validateWindow(query);
    const result = await this.repo.activity(query.organizationId, query, query.page, query.pageSize);
    return { data: result.rows, pagination: this.pagination(query, result.total) };
  }

  /**
   * Creates a new customer-facing offer revision. The source offer, order and
   * invoices are never edited. This is intentionally limited to an unexpired
   * pending review and an organization owner/admin behind a provider_admin
   * account; ordinary provider staff cannot use it.
   */
  async overrideDeal(user: AuthenticatedPrincipal, organizationId: string, offerId: string, dto: ProviderOverrideDto, idempotencyKey: string) {
    await this.assertAdmin(user, organizationId);
    const key = idempotencyKey.trim();
    if (key.length < 8 || key.length > 200) throw new ConflictException("A valid Idempotency-Key header is required");
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException("A nonempty override reason is required");
    const requestHash = createHash("sha256").update(JSON.stringify({ organizationId, offerId, discountPercent: dto.discountPercent, reason })).digest("hex");
    return this.db.transaction(async (client) => {
      const scope = `provider:override:${organizationId}:${offerId}`;
      await client.query(
        `INSERT INTO idempotency_keys (scope, idempotency_key, request_hash, resource_type, expires_at)
         VALUES ($1,$2,$3,'offer',NOW() + INTERVAL '24 hours') ON CONFLICT (scope,idempotency_key) DO NOTHING`, [scope, key, requestHash]);
      const idem = (await client.query<{ request_hash: string; status: string; response_body: Record<string, unknown> | null }>(
        `SELECT request_hash, status, response_body FROM idempotency_keys WHERE scope = $1 AND idempotency_key = $2 FOR UPDATE`, [scope, key])).rows[0]!;
      if (idem.request_hash !== requestHash) throw new ConflictException("Idempotency key was already used with different request data");
      if (idem.status === "succeeded") return idem.response_body;

      const source = (await client.query<{ chat_session_id: string }>(
        `SELECT chat_session_id FROM offers WHERE id = $1 AND organization_id = $2`, [offerId, organizationId])).rows[0];
      if (!source) throw new NotFoundException("Deal not found");
      const session = (await client.query<{ active_offer_id: string | null }>(
        `SELECT active_offer_id FROM chat_sessions WHERE id = $1 FOR UPDATE`, [source.chat_session_id])).rows[0];
      if (!session) throw new NotFoundException("Negotiation session not found");
      if (session.active_offer_id && session.active_offer_id !== offerId) throw new ConflictException("The deal is no longer the active negotiation proposal");
      const original = (await client.query<Record<string, unknown>>(
        `SELECT * FROM offers WHERE id = $1 AND organization_id = $2 FOR UPDATE`, [offerId, organizationId])).rows[0];
      if (!original) throw new NotFoundException("Deal not found");
      if (original.status !== "pending_provider_review") throw new ConflictException("Only pending provider-review deals can be overridden");
      if (original.expires_at && new Date(String(original.expires_at)) <= new Date()) throw new ConflictException("Expired deals cannot be overridden");

      const version = await this.pricing.findVersion(String(original.pricing_version_id), organizationId, client);
      const policy = await this.pricing.findPolicy(String(original.negotiation_policy_id), organizationId, client);
      if (!version || !policy) throw new ConflictException("The historical pricing or negotiation policy is unavailable");
      if (version.version.currency !== String(original.currency)) throw new ConflictException("The offer currency does not match its pricing version");
      const rules = version.rules.filter((rule) => rule.vm_template_id === original.vm_template_id || rule.vm_template_id === null);
      const decision = evaluateNegotiation(String(original.base_price), String(original.currency), policy, rules, { requestedDiscountPercent: dto.discountPercent });
      if (percentBasisPoints(decision.discountPercent) !== percentBasisPoints(dto.discountPercent)) throw new ConflictException("Override exceeds the applicable pricing and negotiation restrictions");
      if (decision.requiresApproval) throw new ConflictException("Override terms still require provider approval under the applicable threshold");
      const discount = parseMoney(decision.discountAmount);
      const finalPrice = parseMoney(decision.finalPrice);

      const oldStatus = String(original.status);
      assertOfferTransition(oldStatus, "countered");
      await client.query(`UPDATE offers SET status = 'countered', updated_at = NOW() WHERE id = $1 AND status = 'pending_provider_review'`, [offerId]);
      await client.query(`INSERT INTO offer_events (offer_id, actor_id, from_status, to_status, event_type, reason, metadata) VALUES ($1,$2,$3,'countered','provider_manual_override',$4,$5::jsonb)`, [offerId, user.userId, oldStatus, reason, JSON.stringify({ revised: true })]);
      const revised = (await client.query<Record<string, unknown>>(
        `INSERT INTO offers (customer_id, organization_id, chat_session_id, pricing_version_id, negotiation_policy_id,
          vm_template_id, vm_configuration, base_price, discount_percent, discount_amount, final_price, currency,
          billing_cycle, rental_duration_days, status, provider_review_reason, presented_at, expires_at, created_by,
          parent_offer_id, commercial_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,'presented',$15,NOW(),NOW() + INTERVAL '7 days',$16,$17,$18::jsonb)
         RETURNING *`, [
          original.customer_id, organizationId, original.chat_session_id, original.pricing_version_id, original.negotiation_policy_id,
          original.vm_template_id, JSON.stringify(original.vm_configuration), original.base_price, decision.discountPercent,
          formatMoney(discount), formatMoney(finalPrice), original.currency, original.billing_cycle, original.rental_duration_days,
          reason, user.userId, offerId, JSON.stringify({ sourceOfferId: offerId, previousDiscountPercent: original.discount_percent, previousDiscountAmount: original.discount_amount, previousFinalPrice: original.final_price, reason, actorId: user.userId })],
      )).rows[0]!;
      await client.query(`INSERT INTO offer_events (offer_id, actor_id, from_status, to_status, event_type, reason, metadata) VALUES ($1,$2,NULL,'presented','provider_manual_override_revision',$3,$4::jsonb)`, [revised.id, user.userId, reason, JSON.stringify({ parentOfferId: offerId })]);
      await client.query(`UPDATE chat_sessions SET active_offer_id = $2, state = 'CUSTOMER_REVIEW', updated_at = NOW() WHERE id = $1`, [original.chat_session_id, revised.id]);
      await this.audit.record({ actorId: user.userId, organizationId, action: "offer.manual_override", entityType: "offer", entityId: String(revised.id), oldData: { offerId, discountPercent: original.discount_percent, discountAmount: original.discount_amount, finalPrice: original.final_price }, newData: { offerId: revised.id, parentOfferId: offerId, discountPercent: decision.discountPercent, discountAmount: formatMoney(discount), finalPrice: formatMoney(finalPrice) }, reason }, client);
      const response = { sourceOfferId: offerId, revisedOffer: this.publicDeal(revised), customerAcceptanceRequired: true, invoiceChanged: false };
      await client.query(`UPDATE idempotency_keys SET status = 'succeeded', response_status = 200, response_body = $3::jsonb, resource_id = $4, updated_at = NOW() WHERE scope = $1 AND idempotency_key = $2`, [scope, key, JSON.stringify(response), revised.id]);
      return response;
    });
  }

  private async assertMember(user: AuthenticatedPrincipal, organizationId: string) {
    if (user.role !== "provider_admin" && user.role !== "provider_staff") throw new ForbiddenException("Provider role required");
    await this.authorization.assertOrganizationMember(user.userId, organizationId);
  }

  private async assertAdmin(user: AuthenticatedPrincipal, organizationId: string) {
    if (user.role !== "provider_admin") throw new ForbiddenException("Provider administrator role required");
    await this.authorization.assertOrganizationMember(user.userId, organizationId, ["owner", "admin"]);
  }

  private validateWindow(query: ProviderReportQueryDto) {
    validateProviderReportWindow(query.from, query.to);
  }

  private windowResponse(query: ProviderReportQueryDto) { return { from: query.from ?? null, to: query.to ?? null, interval: "[from,to)" }; }
  private pagination(query: ProviderReportQueryDto, total: number) { return { page: query.page, pageSize: query.pageSize, total }; }

  private publicDeal(row: Record<string, unknown>) {
    return {
      id: row.id, customerId: row.customer_id, customer: row.customer_name ? { fullName: row.customer_name, email: row.customer_email } : undefined,
      organizationId: row.organization_id, chatSessionId: row.chat_session_id, pricingVersionId: row.pricing_version_id,
      pricingVersionName: row.pricing_version_name ?? row.version_name, negotiationPolicyId: row.negotiation_policy_id,
      vmTemplateId: row.vm_template_id, configuration: row.vm_configuration, pricing: { basePrice: row.base_price, discountPercent: row.discount_percent, discountAmount: row.discount_amount, finalPrice: row.final_price, currency: row.currency },
      billingCycle: row.billing_cycle, rentalDurationDays: row.rental_duration_days, status: row.status,
      providerReviewReason: row.provider_review_reason, presentedAt: row.presented_at, expiresAt: row.expires_at,
      acceptedAt: row.accepted_at, parentOfferId: row.parent_offer_id, order: row.order_id ? { id: row.order_id, orderNumber: row.order_number, status: row.order_status, finalPrice: row.order_final_price, acceptedAt: row.order_accepted_at } : null,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  private publicCustomer(row: Record<string, unknown>) {
    return { id: row.customer_id ?? row.id, fullName: row.full_name, email: row.email, accountStatus: row.account_status, firstActivityAt: row.first_activity_at, lastActivityAt: row.last_activity_at, offerCount: row.offer_count, orderCount: row.order_count, vmCount: row.vm_count, outstandingByCurrency: row.outstanding_by_currency ?? [] };
  }
}

function percentBasisPoints(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
}
