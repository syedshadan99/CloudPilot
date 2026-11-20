import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export enum ChatSessionState {
  New = "NEW",
  RequirementsCollection = "REQUIREMENTS_COLLECTION",
  ConfigurationRecommendation = "CONFIGURATION_RECOMMENDATION",
  PriceCalculation = "PRICE_CALCULATION",
  Negotiation = "NEGOTIATION",
  OfferReady = "OFFER_READY",
  CustomerReview = "CUSTOMER_REVIEW",
  Accepted = "ACCEPTED",
  OrderCreated = "ORDER_CREATED",
  Provisioning = "PROVISIONING",
  Active = "ACTIVE",
  Rejected = "REJECTED",
  Expired = "EXPIRED",
  Escalated = "ESCALATED",
  Cancelled = "CANCELLED",
}

export class CreateSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  customerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export enum MessageRole {
  User = "user",
  Assistant = "assistant",
  System = "system",
}

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;
}

export enum BillingCycle {
  Hourly = "hourly",
  Daily = "daily",
  Monthly = "monthly",
}

export class UpdateRequirementsDto {
  @IsOptional()
  cpuCores?: number;

  @IsOptional()
  ramGb?: number;

  @IsOptional()
  storageGb?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  os?: string;

  @IsOptional()
  durationDays?: number;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  useCase?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
