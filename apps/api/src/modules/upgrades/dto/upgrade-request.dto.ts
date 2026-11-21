import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class CreateUpgradeRequestDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsInt()
  @Min(1)
  @Max(64)
  cpuCores!: number;

  @IsInt()
  @Min(1)
  @Max(512)
  ramGb!: number;

  @IsInt()
  @Min(10)
  @Max(10240)
  storageGb!: number;
}

export class ConfirmUpgradeRequestDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string;
}

export class ApproveUpgradeRequestDto {
  @IsString()
  @IsNotEmpty()
  providerId!: string;
}

export class RejectUpgradeRequestDto {
  @IsString()
  @IsNotEmpty()
  providerId!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
