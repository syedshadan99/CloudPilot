import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  RESOURCE_LIMITS,
  STORAGE_TYPES,
  SUPPORTED_OPERATING_SYSTEMS,
  TEMPLATE_AVAILABILITY,
} from "../catalog.constants.js";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const regionPattern = /^[a-z0-9][a-z0-9-]{0,62}$/;
const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;

export class CatalogQueryDto {
  @IsOptional() @IsString() @MaxLength(120) region?: string;
  @IsOptional() @IsIn(SUPPORTED_OPERATING_SYSTEMS) operatingSystem?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(RESOURCE_LIMITS.cpuCores.min) @Max(RESOURCE_LIMITS.cpuCores.max) minCpuCores?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(RESOURCE_LIMITS.ramGb.min) @Max(RESOURCE_LIMITS.ramGb.max) minRamGb?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(RESOURCE_LIMITS.storageGb.min) @Max(RESOURCE_LIMITS.storageGb.max) minStorageGb?: number;
  @IsOptional() @IsIn(STORAGE_TYPES) storageType?: string;
  @IsOptional() @IsIn(TEMPLATE_AVAILABILITY) availability?: string;
  @IsOptional() @Transform(({ value }) => value === true || value === "true") @IsBoolean() includeUnavailable = false;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

export class ProviderOrganizationQueryDto {
  @IsUUID() organizationId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

export class CreateVmTemplateDto {
  @IsUUID() organizationId!: string;
  @Transform(trim) @IsString() @Length(1, 120) name!: string;
  @Transform(trim) @Matches(slugPattern) @MaxLength(120) slug!: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsInt() @Min(RESOURCE_LIMITS.cpuCores.min) @Max(RESOURCE_LIMITS.cpuCores.max) cpuCores!: number;
  @IsInt() @Min(RESOURCE_LIMITS.ramGb.min) @Max(RESOURCE_LIMITS.ramGb.max) ramGb!: number;
  @IsInt() @Min(RESOURCE_LIMITS.storageGb.min) @Max(RESOURCE_LIMITS.storageGb.max) storageGb!: number;
  @IsIn(STORAGE_TYPES) storageType!: string;
  @Transform(trim) @IsIn(SUPPORTED_OPERATING_SYSTEMS) operatingSystem!: string;
  @IsInt() @Min(RESOURCE_LIMITS.bandwidthMbps.min) @Max(RESOURCE_LIMITS.bandwidthMbps.max) bandwidthMbps!: number;
  @Transform(trim) @Matches(regionPattern) @MaxLength(63) region!: string;
  @IsOptional() @IsIn(TEMPLATE_AVAILABILITY) availability?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsUUID() pricingVersionId?: string;
  @IsOptional() @IsUUID() capacityPoolId?: string;
}

export class UpdateVmTemplateDto {
  @Transform(trim) @IsOptional() @IsString() @Length(1, 120) name?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsInt() @Min(RESOURCE_LIMITS.cpuCores.min) @Max(RESOURCE_LIMITS.cpuCores.max) cpuCores?: number;
  @IsOptional() @IsInt() @Min(RESOURCE_LIMITS.ramGb.min) @Max(RESOURCE_LIMITS.ramGb.max) ramGb?: number;
  @IsOptional() @IsInt() @Min(RESOURCE_LIMITS.storageGb.min) @Max(RESOURCE_LIMITS.storageGb.max) storageGb?: number;
  @IsOptional() @IsIn(STORAGE_TYPES) storageType?: string;
  @Transform(trim) @IsOptional() @IsIn(SUPPORTED_OPERATING_SYSTEMS) operatingSystem?: string;
  @IsOptional() @IsInt() @Min(RESOURCE_LIMITS.bandwidthMbps.min) @Max(RESOURCE_LIMITS.bandwidthMbps.max) bandwidthMbps?: number;
  @Transform(trim) @IsOptional() @Matches(regionPattern) @MaxLength(63) region?: string;
  @IsOptional() @IsIn(TEMPLATE_AVAILABILITY) availability?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsUUID() pricingVersionId?: string;
  @IsOptional() @IsUUID() capacityPoolId?: string;
}

export class CreateCapacityPoolDto {
  @IsUUID() organizationId!: string;
  @Transform(trim) @IsString() @Length(1, 120) name!: string;
  @Transform(trim) @Matches(regionPattern) @MaxLength(63) region!: string;
  @IsInt() @Min(1) @Max(2147483647) totalCpuCores!: number;
  @IsInt() @Min(1) @Max(2147483647) totalRamGb!: number;
  @IsInt() @Min(1) @Max(2147483647) totalStorageGb!: number;
  @IsOptional() @IsBoolean() available?: boolean;
}

export class UpdateCapacityPoolDto {
  @Transform(trim) @IsOptional() @IsString() @Length(1, 120) name?: string;
  @Transform(trim) @IsOptional() @Matches(regionPattern) @MaxLength(63) region?: string;
  @IsOptional() @IsInt() @Min(1) @Max(2147483647) totalCpuCores?: number;
  @IsOptional() @IsInt() @Min(1) @Max(2147483647) totalRamGb?: number;
  @IsOptional() @IsInt() @Min(1) @Max(2147483647) totalStorageGb?: number;
  @IsOptional() @IsBoolean() available?: boolean;
}

export class AvailabilityQueryDto {
  @IsUUID() organizationId!: string;
  @IsInt() @Min(1) @Max(256) cpuCores!: number;
  @IsInt() @Min(1) @Max(4096) ramGb!: number;
  @IsInt() @Min(1) @Max(65536) storageGb!: number;
  @Transform(trim) @Matches(regionPattern) region!: string;
}
