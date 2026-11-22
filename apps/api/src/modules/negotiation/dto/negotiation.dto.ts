import { Transform } from "class-transformer";
import { IsOptional, IsUUID, Matches, MaxLength } from "class-validator";
import { IsIn, IsInt, IsString, Max, Min } from "class-validator";
import { BILLING_CYCLES } from "../../identity/identity.constants.js";
import { RESOURCE_LIMITS, STORAGE_TYPES, SUPPORTED_OPERATING_SYSTEMS } from "../../catalog/catalog.constants.js";

const decimalPattern = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/;
const percentPattern = /^(?:0|[1-9]\d?)(?:\.\d{1,2})?$|^100(?:\.0{1,2})?$/;
const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;

export class StartNegotiationDto {
  @IsUUID()
  chatSessionId!: string;

  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsInt() @Min(RESOURCE_LIMITS.cpuCores.min) @Max(RESOURCE_LIMITS.cpuCores.max) cpuCores?: number;
  @IsOptional() @IsInt() @Min(RESOURCE_LIMITS.ramGb.min) @Max(RESOURCE_LIMITS.ramGb.max) ramGb?: number;
  @IsOptional() @IsInt() @Min(RESOURCE_LIMITS.storageGb.min) @Max(RESOURCE_LIMITS.storageGb.max) storageGb?: number;
  @IsOptional() @IsIn(STORAGE_TYPES) storageType?: string;
  @IsOptional() @IsIn(SUPPORTED_OPERATING_SYSTEMS) operatingSystem?: string;
  @IsOptional() @IsInt() @Min(RESOURCE_LIMITS.bandwidthMbps.min) @Max(RESOURCE_LIMITS.bandwidthMbps.max) bandwidthMbps?: number;
  @IsOptional() @IsString() @MaxLength(63) region?: string;
  @IsOptional() @IsIn(BILLING_CYCLES) billingCycle?: "hourly" | "daily" | "monthly";
  @IsOptional() @IsInt() @Min(1) @Max(3650) rentalDurationDays?: number;

  @IsOptional()
  @Matches(percentPattern, { message: "requestedDiscountPercent must be a percentage from 0 to 100 with at most two decimals" })
  requestedDiscountPercent?: string;

  @IsOptional()
  @Matches(decimalPattern)
  requestedPrice?: string;

  @Transform(trim)
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}

export class CounterNegotiationDto {
  @IsOptional()
  @Matches(percentPattern, { message: "requestedDiscountPercent must be a percentage from 0 to 100 with at most two decimals" })
  requestedDiscountPercent?: string;

  @IsOptional()
  @Matches(decimalPattern)
  requestedPrice?: string;

  @Transform(trim)
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
