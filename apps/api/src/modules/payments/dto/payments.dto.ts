import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

export class SimulatedPaymentDto {
  @IsUUID() invoiceId!: string;
  @IsString() @Matches(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/) amount!: string;
  @IsString() @Matches(/^[A-Z]{3}$/) currency!: string;
}

export class PaymentIdempotencyDto {
  @IsString() @MinLength(8) @MaxLength(200) idempotencyKey!: string;
}

export class PaymentListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsEnum(["pending", "verified", "failed", "reversed"]) status?: string;
  @IsOptional() @IsUUID() invoiceId?: string;
}
