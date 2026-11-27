import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class InvoiceListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsEnum(["issued", "partially_paid", "paid", "overdue", "void", "uncollectible"]) status?: string;
}

export class BillingListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsUUID() vmId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
