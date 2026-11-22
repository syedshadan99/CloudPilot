import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthorizationService } from "../../identity/services/authorization.service.js";
import type { AuthenticatedPrincipal } from "../../../common/auth/authenticated-principal.js";
import { PricingRepository } from "../repositories/pricing.repository.js";
import { parseMoney, formatMoney } from "./money.js";

export interface PolicyEvaluationInput {
  organizationId: string;
  basePrice: string;
  proposedPrice: string;
  discountPercent: string;
  currency: string;
  pricingRuleMinimumPrice?: string;
  pricingRuleMaximumDiscountPercent?: string;
}

@Injectable()
export class PolicyService {
  constructor(private readonly repo: PricingRepository, private readonly authorization: AuthorizationService) {}

  async list(user: AuthenticatedPrincipal, organizationId: string, page: number, pageSize: number) {
    await this.assertMember(user, organizationId);
    const result = await this.repo.listPolicies(organizationId, page, pageSize);
    return { data: result.data.map((row) => this.publicPolicy(row)), pagination: { page, pageSize, total: result.total } };
  }

  async get(user: AuthenticatedPrincipal, organizationId: string, id: string) {
    await this.assertMember(user, organizationId);
    const row = await this.repo.findPolicy(id, organizationId);
    if (!row) throw new ConflictException("Negotiation policy not found");
    return this.publicPolicy(row);
  }

  async create(user: AuthenticatedPrincipal, dto: Record<string, unknown>) {
    await this.assertAdmin(user, dto.organizationId as string);
    this.validatePolicy(dto);
    const row = await this.repo.createPolicy({ ...dto, createdBy: user.userId });
    return this.publicPolicy(row);
  }

  async update(user: AuthenticatedPrincipal, organizationId: string, id: string, dto: Record<string, unknown>) {
    await this.assertAdmin(user, organizationId);
    this.validatePolicy(dto);
    const row = await this.repo.updatePolicy(id, organizationId, dto, user.userId);
    if (!row) throw new ConflictException("Negotiation policy not found");
    return this.publicPolicy(row);
  }

  async activate(user: AuthenticatedPrincipal, organizationId: string, id: string) {
    await this.assertAdmin(user, organizationId);
    return this.publicPolicy(await this.repo.activatePolicy(id, organizationId, user.userId));
  }

  async deactivate(user: AuthenticatedPrincipal, organizationId: string, id: string) {
    await this.assertAdmin(user, organizationId);
    return this.publicPolicy(await this.repo.deactivatePolicy(id, organizationId, user.userId));
  }

  async evaluate(user: AuthenticatedPrincipal, dto: PolicyEvaluationInput) {
    await this.assertMember(user, dto.organizationId);
    const policy = await this.repo.effectivePolicy(dto.organizationId);
    if (!policy) throw new ConflictException("No effective negotiation policy exists for this provider");
    const base = parseMoney(dto.basePrice);
    const proposed = parseMoney(dto.proposedPrice);
    const requestedDiscount = parseMoney(dto.discountPercent);
    const maximumDiscount = parseMoney(policy.maximum_discount_percent);
    const ruleMaximum = dto.pricingRuleMaximumDiscountPercent ? parseMoney(dto.pricingRuleMaximumDiscountPercent) : maximumDiscount;
    const floor = [parseMoney(policy.minimum_price), dto.pricingRuleMinimumPrice ? parseMoney(dto.pricingRuleMinimumPrice) : 0n].reduce((max, value) => value > max ? value : max, 0n);
    const maximumAllowed = maximumDiscount < ruleMaximum ? maximumDiscount : ruleMaximum;
    const discountAllowed = requestedDiscount <= maximumAllowed;
    const floorSatisfied = proposed >= floor;
    return {
      policyId: policy.id,
      policyName: policy.name,
      currency: dto.currency,
      maximumDiscountPercent: formatMoney(maximumAllowed),
      minimumPrice: formatMoney(floor),
      candidate: { basePrice: formatMoney(base), proposedPrice: formatMoney(proposed), discountPercent: formatMoney(requestedDiscount) },
      discountAllowed,
      priceFloorSatisfied: floorSatisfied,
      requiresApproval: floorSatisfied && proposed < parseMoney(policy.approval_threshold),
      allowed: discountAllowed && floorSatisfied,
      maximumAttempts: policy.maximum_attempts,
      effectiveFrom: policy.effective_from,
      effectiveTo: policy.effective_to,
    };
  }

  private publicPolicy(row: Awaited<ReturnType<PricingRepository["findPolicy"]>> & object) {
    return { id: row.id, organizationId: row.organization_id, name: row.name, maximumDiscountPercent: row.maximum_discount_percent, minimumPrice: row.minimum_price, approvalThreshold: row.approval_threshold, maximumAttempts: row.maximum_attempts, effectiveFrom: row.effective_from, effectiveTo: row.effective_to, active: row.active, createdBy: row.created_by, createdAt: row.created_at };
  }

  private async assertMember(user: AuthenticatedPrincipal, organizationId: string) {
    if (user.role !== "provider_admin" && user.role !== "provider_staff") throw new ForbiddenException("Provider role required");
    await this.authorization.assertOrganizationMember(user.userId, organizationId);
  }

  private async assertAdmin(user: AuthenticatedPrincipal, organizationId: string) {
    if (user.role !== "provider_admin") throw new ForbiddenException("Provider administrator role required");
    await this.authorization.assertOrganizationMember(user.userId, organizationId, ["owner", "admin"]);
  }

  private validatePolicy(input: Record<string, unknown>): void {
    if (input.maximumDiscountPercent !== undefined && parseMoney(input.maximumDiscountPercent as string) > parseMoney("100")) throw new BadRequestException("Maximum discount cannot exceed 100 percent");
    if (input.minimumPrice !== undefined && parseMoney(input.minimumPrice as string) < 0n) throw new BadRequestException("Minimum price cannot be negative");
    if (input.approvalThreshold !== undefined && parseMoney(input.approvalThreshold as string) < 0n) throw new BadRequestException("Approval threshold cannot be negative");
    if (input.effectiveFrom && input.effectiveTo && new Date(input.effectiveTo as string) <= new Date(input.effectiveFrom as string)) throw new BadRequestException("Effective-to must be later than effective-from");
  }
}
