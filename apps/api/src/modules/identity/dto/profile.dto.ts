import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from "class-validator";
import { CUSTOMER_WORKLOADS, SUPPORTED_CURRENCIES } from "../identity.constants.js";

const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;

export class UpdateProfileDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 200)
  fullName?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsIn(CUSTOMER_WORKLOADS)
  workloadType?: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  billingEmail?: string;

  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value)
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  preferredCurrency?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 100)
  timezone?: string;
}
