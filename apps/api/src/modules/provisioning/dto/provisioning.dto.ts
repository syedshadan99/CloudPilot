import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MaxLength,
} from "class-validator";

export class VmConfigDto {
  @IsInt() @Min(1) @Max(64)
  cpuCores!: number;

  @IsInt() @Min(1) @Max(512)
  ramGb!: number;

  @IsInt() @Min(1) @Max(10240)
  storageGb!: number;

  @IsString() @IsNotEmpty() @MaxLength(100)
  os!: string;
}

export class CreateProvisioningJobDto {
  @IsUUID()
  orderId!: string;
}

export class RetryJobDto {
  @IsUUID()
  jobId!: string;
}
