import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class InvoiceListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}
