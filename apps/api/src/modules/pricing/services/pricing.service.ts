import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../common/auth/authenticated-principal.js";
import { AuthorizationService } from "../../identity/services/authorization.service.js";
import { IdentityService } from "../../identity/services/identity.service.js";
import type { CreatePricingRuleDto, CreatePricingVersionDto, QuoteDto, UpdatePricingRuleDto, UpdatePricingVersionDto } from "../dto/pricing.dto.js";
import { PricingRepository, type PricingRuleRow, type PricingVersionRow } from "../repositories/pricing.repository.js";
import { formatMoney, parseMoney, periodCount, multiplyMoneyByInteger } from "./money.js";

@Injectable()
export class PricingService {
  constructor(
    private readonly repo: PricingRepository,
    private readonly authorization: AuthorizationService,
    private readonly identity: IdentityService,
  ) {}

  async listVersions(user: AuthenticatedPrincipal, organizationId: string, page: number, pageSize: number, includeRules: boolean) {
    await this.assertMember(user, organizationId);
    const result = await this.repo.listVersions(organizationId, page, pageSize, includeRules);
    return { data: result.data.map(({ version, rules }) => this.publicVersion(version, rules)), pagination: { page, pageSize, total: result.total } };
  }

  async getVersion(user: AuthenticatedPrincipal, organizationId: string, id: string) {
    await this.assertMember(user, organizationId);
    const found = await this.repo.findVersion(id, organizationId);
    if (!found) throw new NotFoundException("Pricing version not found");
    return this.publicVersion(found.version, found.rules);
  }

  async createVersion(user: AuthenticatedPrincipal, dto: CreatePricingVersionDto) {
    await this.assertAdmin(user, dto.organizationId);
    this.validateDateRange(dto.effectiveFrom, dto.effectiveTo);
    try {
      const row = await this.repo.createVersion({ ...dto, createdBy: user.userId });
      return this.publicVersion(row);
    } catch (error) { if (this.isUniqueViolation(error)) throw new ConflictException("Pricing version name already exists"); throw error; }
  }

  async updateVersion(user: AuthenticatedPrincipal, organizationId: string, id: string, dto: UpdatePricingVersionDto) {
    await this.assertAdmin(user, organizationId);
    this.validateDateRange(dto.effectiveFrom, dto.effectiveTo);
    try {
      const row = await this.repo.updateVersion(id, organizationId, dto as unknown as Record<string, unknown>, user.userId);
      if (!row) throw new NotFoundException("Pricing version not found");
      return this.publicVersion(row);
    } catch (error) { if (this.isUniqueViolation(error)) throw new ConflictException("Pricing version name already exists"); throw error; }
  }

  async createRule(user: AuthenticatedPrincipal, organizationId: string, versionId: string, dto: CreatePricingRuleDto) {
    await this.assertAdmin(user, organizationId); this.validateRule(dto);
    try { return this.publicRule(await this.repo.createRule(versionId, organizationId, dto as unknown as Record<string, unknown>, user.userId)); }
    catch (error) { if (this.isUniqueViolation(error)) throw new ConflictException("A rule with this version/template/type scope already exists"); throw error; }
  }

  async updateRule(user: AuthenticatedPrincipal, organizationId: string, versionId: string, ruleId: string, dto: UpdatePricingRuleDto) {
    await this.assertAdmin(user, organizationId); this.validateRule(dto);
    const row = await this.repo.updateRule(ruleId, versionId, organizationId, dto as unknown as Record<string, unknown>, user.userId);
    if (!row) throw new NotFoundException("Pricing rule not found"); return this.publicRule(row);
  }

  async deleteRule(user: AuthenticatedPrincipal, organizationId: string, versionId: string, ruleId: string) {
    await this.assertAdmin(user, organizationId); await this.repo.deleteRule(ruleId, versionId, organizationId, user.userId); return { deleted: true };
  }

  async activate(user: AuthenticatedPrincipal, organizationId: string, id: string) {
    await this.assertAdmin(user, organizationId); return this.publicVersion(await this.repo.activateVersion(id, organizationId, user.userId));
  }

  async retire(user: AuthenticatedPrincipal, organizationId: string, id: string) {
    await this.assertAdmin(user, organizationId); return this.publicVersion(await this.repo.retireVersion(id, organizationId, user.userId));
  }

  async quote(user: AuthenticatedPrincipal, dto: QuoteDto) {
    await this.identity.assertActiveCustomer(user.userId);
    const context = await this.repo.loadQuoteContext(dto.templateId, dto.organizationId, dto.region);
    const config = dto.templateId && context.template ? {
      templateId: context.template.id, organizationId: context.organizationId, name: context.template.name, slug: context.template.slug,
      cpuCores: context.template.cpu_cores, ramGb: context.template.ram_gb, storageGb: context.template.storage_gb,
      storageType: context.template.storage_type, operatingSystem: context.template.operating_system, bandwidthMbps: context.template.bandwidth_mbps, region: context.template.region,
    } : this.customConfiguration(dto, context.organizationId);
    const pool = context.pools.find((candidate) => candidate.total_cpu_cores - Number(candidate.cpu_used) >= config.cpuCores && candidate.total_ram_gb - Number(candidate.ram_used) >= config.ramGb && candidate.total_storage_gb - Number(candidate.storage_used) >= config.storageGb);
    const availability = pool ? { available: true, poolId: pool.id } : { available: false, reason: "Requested CPU, RAM and storage do not fit in an enabled simulated pool" };
    const rules = context.rules.filter((rule) => rule.vm_template_id === (context.template?.id ?? null) || (rule.vm_template_id === null && (!dto.templateId || rule.rule_type !== "template_base")));
    const baseRule = dto.templateId ? rules.find((rule) => rule.rule_type === "template_base" && rule.vm_template_id === context.template?.id) : rules.find((rule) => rule.rule_type === "custom" && rule.vm_template_id === null);
    if (!baseRule) throw new ConflictException("No applicable pricing rule exists for this configuration");
    const periods = (() => { try { return periodCount(dto.billingCycle, dto.rentalDurationDays); } catch (error) { if (error instanceof Error && error.message === "MONTHLY_DURATION_MUST_BE_MULTIPLE_OF_30_DAYS") throw new BadRequestException("Monthly quotations require a rental duration in whole 30-day periods"); throw new BadRequestException("Rental duration is invalid"); } })();
    const lines: Array<{ component: string; quantity: number; unitRate: string; amount: string }> = [];
    let total = 0n;
    const baseRate = this.rateFor(baseRule, dto.billingCycle);
    const baseAmount = multiplyMoneyByInteger(parseMoney(baseRate), periods);
    total += baseAmount; lines.push({ component: dto.templateId ? "template_base" : "custom_base", quantity: periods, unitRate: baseRate, amount: formatMoney(baseAmount) });
    const addonTypes: Array<[string, number, string]> = [["cpu_addon", config.cpuCores, "cpu_cores"], ["ram_addon", config.ramGb, "ram_gb"], ["storage_addon", config.storageGb, "storage_gb"], ["bandwidth_addon", config.bandwidthMbps, "bandwidth_mbps"]];
    for (const [type, quantity, label] of addonTypes) {
      const rule = rules.find((candidate) => candidate.rule_type === type && (candidate.vm_template_id === null || candidate.vm_template_id === context.template?.id));
      if (!rule) continue;
      const amount = multiplyMoneyByInteger(parseMoney(this.rateFor(rule, dto.billingCycle)), quantity * periods); total += amount;
      lines.push({ component: label, quantity: quantity * periods, unitRate: this.rateFor(rule, dto.billingCycle), amount: formatMoney(amount) });
    }
    const minimum = rules.reduce((max, rule) => { const value = rule.minimum_price ? parseMoney(rule.minimum_price) : 0n; return value > max ? value : max; }, 0n);
    if (total < minimum) { const adjustment = minimum - total; total = minimum; lines.push({ component: "minimum_price_adjustment", quantity: 1, unitRate: formatMoney(adjustment), amount: formatMoney(adjustment) }); }
    return {
      nonBinding: true, calculatedAt: new Date().toISOString(), availability,
      configuration: config, pricingVersion: { id: context.version.id, name: context.version.version_name, currency: context.version.currency, effectiveFrom: context.version.effective_from, effectiveTo: context.version.effective_to },
      billingCycle: dto.billingCycle, rentalDurationDays: dto.rentalDurationDays, periods, currency: context.version.currency,
      breakdown: lines, baseTotal: formatMoney(total), total: formatMoney(total),
      note: "This is a backend-calculated, nonbinding base quotation. It does not create an offer, order, invoice, payment or VM.",
    };
  }

  private customConfiguration(dto: QuoteDto, organizationId: string) {
    if (!dto.cpuCores || !dto.ramGb || !dto.storageGb || !dto.storageType || !dto.operatingSystem || !dto.bandwidthMbps || !dto.region) throw new BadRequestException("Custom quotations require CPU, RAM, storage, storage type, operating system, bandwidth and region");
    return { templateId: null, organizationId, name: "Custom configuration", slug: null, cpuCores: dto.cpuCores, ramGb: dto.ramGb, storageGb: dto.storageGb, storageType: dto.storageType, operatingSystem: dto.operatingSystem, bandwidthMbps: dto.bandwidthMbps, region: dto.region };
  }

  private rateFor(rule: PricingRuleRow, cycle: QuoteDto["billingCycle"]): string {
    const value = cycle === "hourly" ? rule.hourly_rate : cycle === "daily" ? rule.daily_rate : rule.monthly_rate;
    if (value !== null && value !== undefined) return value;
    if (rule.unit_price !== null && rule.unit_price !== undefined) return rule.unit_price;
    throw new ConflictException(`Pricing rule ${rule.id} has no ${cycle} rate`);
  }

  private validateRule(dto: Partial<CreatePricingRuleDto>): void {
    if (![dto.hourlyRate, dto.dailyRate, dto.monthlyRate, dto.unitPrice].some((value) => value !== undefined)) throw new BadRequestException("A pricing rule needs at least one rate");
    if (dto.maximumDiscountPercent !== undefined && parseMoney(dto.maximumDiscountPercent) > parseMoney("100")) throw new BadRequestException("Maximum discount cannot exceed 100 percent");
    if (dto.metadata && JSON.stringify(dto.metadata).length > 16_384) throw new BadRequestException("Pricing metadata is too large");
  }

  private validateDateRange(from?: string, to?: string): void { if (from && to && new Date(to) <= new Date(from)) throw new BadRequestException("Effective-to must be later than effective-from"); }
  private async assertMember(user: AuthenticatedPrincipal, organizationId: string) { if (user.role !== "provider_admin" && user.role !== "provider_staff") throw new ForbiddenException("Provider role required"); await this.authorization.assertOrganizationMember(user.userId, organizationId); }
  private async assertAdmin(user: AuthenticatedPrincipal, organizationId: string) { if (user.role !== "provider_admin") throw new ForbiddenException("Provider administrator role required"); await this.authorization.assertOrganizationMember(user.userId, organizationId, ["owner", "admin"]); }
  private publicVersion(row: PricingVersionRow, rules?: PricingRuleRow[]) { return { id: row.id, organizationId: row.organization_id, versionName: row.version_name, currency: row.currency, effectiveFrom: row.effective_from, effectiveTo: row.effective_to, status: row.status, createdBy: row.created_by, createdAt: row.created_at, ...(rules ? { rules: rules.map((rule) => this.publicRule(rule)) } : {}) }; }
  private publicRule(row: PricingRuleRow) { return { id: row.id, pricingVersionId: row.pricing_version_id, vmTemplateId: row.vm_template_id, ruleType: row.rule_type, hourlyRate: row.hourly_rate, dailyRate: row.daily_rate, monthlyRate: row.monthly_rate, unitPrice: row.unit_price, minimumPrice: row.minimum_price, maximumDiscountPercent: row.maximum_discount_percent, metadata: row.metadata, createdAt: row.created_at }; }
  private isUniqueViolation(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505"; }
}
