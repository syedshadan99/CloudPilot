import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { BILLING_CYCLES, CUSTOMER_WORKLOADS, ONBOARDING_STEPS, SUPPORTED_CURRENCIES, TECHNICAL_LEVELS } from "../../identity/identity.constants.js";

export class UpdateOnboardingDto {
  @IsOptional()
  @IsIn(ONBOARDING_STEPS.filter((step) => step !== "complete"))
  currentStep?: string;

  @IsOptional()
  @IsIn(CUSTOMER_WORKLOADS)
  workloadType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  @IsOptional()
  @IsIn(BILLING_CYCLES)
  billingCycle?: string;

  @IsOptional()
  @IsIn(TECHNICAL_LEVELS)
  technicalLevel?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value)
  @IsIn(SUPPORTED_CURRENCIES)
  preferredCurrency?: string;

  @IsOptional()
  @IsBoolean()
  skip?: boolean;
}
