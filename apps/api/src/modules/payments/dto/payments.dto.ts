import { IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";

export class SimulatedPaymentDto {
  @IsUUID() invoiceId!: string;
  @IsString() @Matches(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/) amount!: string;
  @IsString() @Matches(/^[A-Z]{3}$/) currency!: string;
}

export class PaymentIdempotencyDto {
  @IsString() @MinLength(8) @MaxLength(200) idempotencyKey!: string;
}
