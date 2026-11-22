import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export const OFFER_STATUSES = ["draft", "presented", "countered", "pending_provider_review", "approved", "accepted", "declined", "expired", "rejected", "cancelled"] as const;

export class OfferListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsIn(OFFER_STATUSES) status?: string;
  @IsOptional() @IsUUID() chatSessionId?: string;
}

export class ProviderOfferQueryDto {
  @IsUUID() organizationId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

export class OfferDecisionDto {
  @IsString() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @Min(1) @MaxLength(1000) reason!: string;
}

export class DeclineOfferDto {
  @IsOptional() @IsString() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @MaxLength(1000) reason?: string;
}
