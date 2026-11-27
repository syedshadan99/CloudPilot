import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  MaxLength,
  MinLength,
  Min,
  IsString,
} from "class-validator";

const decimalPattern = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/;
const percentPattern = /^(?:0|[1-9]\d?|100)(?:\.\d{1,2})?$/;
export const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export const PROVIDER_DEAL_STATUSES = [
  "draft",
  "presented",
  "countered",
  "pending_provider_review",
  "approved",
  "accepted",
  "declined",
  "expired",
  "rejected",
  "cancelled",
] as const;

export class ProviderReportQueryDto {
  @Matches(UUID_SHAPE)
  organizationId!: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @IsIn(PROVIDER_DEAL_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(["pending_payment", "payment_verified", "provisioning", "provisioning_failed", "active", "suspended", "cancelled", "completed"])
  orderStatus?: string;

  @IsOptional()
  @IsIn(["CREATING", "PROVISIONING", "BOOTING", "RUNNING", "STOPPING", "STOPPED", "RESTARTING", "RESIZING", "SUSPENDED", "TERMINATING", "TERMINATED", "FAILED"])
  vmState?: string;

  @IsOptional()
  @IsIn(["issued", "partially_paid", "paid", "overdue", "void", "uncollectible"])
  invoiceStatus?: string;

  @IsOptional()
  @Matches(UUID_SHAPE)
  customerId?: string;

  @IsOptional()
  @Matches(UUID_SHAPE)
  pricingVersionId?: string;

  @IsOptional()
  @Matches(UUID_SHAPE)
  vmTemplateId?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.toUpperCase() : value))
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsIn(["hourly", "daily", "monthly"])
  billingCycle?: string;

  @IsOptional()
  @Matches(decimalPattern)
  minDiscountPercent?: string;

  @IsOptional()
  @Matches(decimalPattern)
  maxDiscountPercent?: string;
}

export class ProviderOverrideDto {
  @Matches(percentPattern)
  discountPercent!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}
