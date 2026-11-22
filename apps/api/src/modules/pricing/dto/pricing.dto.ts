import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from "class-validator";
import { BILLING_CYCLES, SUPPORTED_CURRENCIES } from "../../identity/identity.constants.js";
import { RESOURCE_LIMITS, STORAGE_TYPES, SUPPORTED_OPERATING_SYSTEMS } from "../../catalog/catalog.constants.js";

const decimalPattern = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/;
const regionPattern = /^[a-z0-9][a-z0-9-]{0,62}$/;
const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;

export const PRICING_RULE_TYPES = ["template_base", "cpu_addon", "ram_addon", "storage_addon", "bandwidth_addon", "custom"] as const;
export type PricingRuleType = (typeof PRICING_RULE_TYPES)[number];

export class PricingOrganizationQueryDto {
  @IsUUID() organizationId!: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() includeRules = false;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

export class CreatePricingVersionDto {
  @IsUUID() organizationId!: string;
  @Transform(trim) @IsString() @Length(1, 120) versionName!: string;
  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value) @IsIn(SUPPORTED_CURRENCIES) currency!: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}

export class UpdatePricingVersionDto {
  @Transform(trim) @IsOptional() @IsString() @Length(1, 120) versionName?: string;
  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value) @IsOptional() @IsIn(SUPPORTED_CURRENCIES) currency?: string;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}

export class CreatePricingRuleDto {
  @IsOptional() @IsUUID() vmTemplateId?: string;
  @IsIn(PRICING_RULE_TYPES) ruleType!: PricingRuleType;
  @IsOptional() @Matches(decimalPattern) hourlyRate?: string;
  @IsOptional() @Matches(decimalPattern) dailyRate?: string;
  @IsOptional() @Matches(decimalPattern) monthlyRate?: string;
  @IsOptional() @Matches(decimalPattern) unitPrice?: string;
  @IsOptional() @Matches(decimalPattern) minimumPrice?: string;
  @IsOptional() @Matches(decimalPattern) maximumDiscountPercent?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class UpdatePricingRuleDto {
  @IsOptional() @Matches(decimalPattern) hourlyRate?: string;
  @IsOptional() @Matches(decimalPattern) dailyRate?: string;
  @IsOptional() @Matches(decimalPattern) monthlyRate?: string;
  @IsOptional() @Matches(decimalPattern) unitPrice?: string;
  @IsOptional() @Matches(decimalPattern) minimumPrice?: string;
  @IsOptional() @Matches(decimalPattern) maximumDiscountPercent?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class QuoteDto {
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsInt() @Min(RESOURCE_LIMITS.cpuCores.min) @Max(RESOURCE_LIMITS.cpuCores.max) cpuCores?: number;
  @IsOptional() @IsInt() @Min(RESOURCE_LIMITS.ramGb.min) @Max(RESOURCE_LIMITS.ramGb.max) ramGb?: number;
  @IsOptional() @IsInt() @Min(RESOURCE_LIMITS.storageGb.min) @Max(RESOURCE_LIMITS.storageGb.max) storageGb?: number;
  @IsOptional() @IsIn(STORAGE_TYPES) storageType?: string;
  @IsOptional() @IsIn(SUPPORTED_OPERATING_SYSTEMS) operatingSystem?: string;
  @IsOptional() @IsInt() @Min(RESOURCE_LIMITS.bandwidthMbps.min) @Max(RESOURCE_LIMITS.bandwidthMbps.max) bandwidthMbps?: number;
  @Transform(trim) @IsOptional() @Matches(regionPattern) @MaxLength(63) region?: string;
  @IsIn(BILLING_CYCLES) billingCycle!: "hourly" | "daily" | "monthly";
  @IsInt() @Min(1) @Max(3650) rentalDurationDays!: number;
}

export class CreateNegotiationPolicyDto {
  @IsUUID() organizationId!: string;
  @Transform(trim) @IsString() @Length(1, 120) name!: string;
  @Matches(decimalPattern) maximumDiscountPercent!: string;
  @Matches(decimalPattern) minimumPrice!: string;
  @Matches(decimalPattern) approvalThreshold!: string;
  @IsInt() @Min(1) @Max(50) maximumAttempts!: number;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}

export class UpdateNegotiationPolicyDto {
  @Transform(trim) @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @Matches(decimalPattern) maximumDiscountPercent?: string;
  @IsOptional() @Matches(decimalPattern) minimumPrice?: string;
  @IsOptional() @Matches(decimalPattern) approvalThreshold?: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) maximumAttempts?: number;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}

export class PolicyEvaluationDto {
  @IsUUID() organizationId!: string;
  @Matches(decimalPattern) basePrice!: string;
  @Matches(decimalPattern) proposedPrice!: string;
  @Matches(decimalPattern) discountPercent!: string;
  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value) @IsIn(SUPPORTED_CURRENCIES) currency!: string;
  @IsOptional() @Matches(decimalPattern) pricingRuleMinimumPrice?: string;
  @IsOptional() @Matches(decimalPattern) pricingRuleMaximumDiscountPercent?: string;
}
