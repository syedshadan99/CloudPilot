import { Transform } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { CUSTOMER_WORKLOADS, SUPPORTED_CURRENCIES } from "../identity.constants.js";

const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;

export class RegisterDto {
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  fullName!: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsIn(CUSTOMER_WORKLOADS)
  workloadType!: string;

  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value)
  @IsIn(SUPPORTED_CURRENCIES)
  preferredCurrency!: string;

  @IsBoolean()
  @Equals(true, { message: "termsAccepted must be true" })
  termsAccepted!: boolean;
}

export class LoginDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class EmailCredentialDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class TokenCredentialDto {
  @IsString()
  @Length(43, 128)
  token!: string;
}

export class ResetPasswordDto extends TokenCredentialDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class ResendVerificationDto extends EmailCredentialDto {}

// Kept explicit for future clients that want to send an expected duration in
// the first registration request; it is not currently accepted by registration.
export class DurationDto {
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays!: number;
}
