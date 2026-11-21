import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class AppendAuditLogDto {
  @IsString()
  @IsNotEmpty()
  actorId!: string;

  @IsString()
  @IsOptional()
  actorRole?: string; // 'CUSTOMER', 'PROVIDER', 'SYSTEM'

  @IsString()
  @IsNotEmpty()
  action!: string; // e.g. 'VM_START', 'OFFER_ACCEPTED'

  @IsString()
  @IsNotEmpty()
  entityType!: string; // e.g. 'VIRTUAL_MACHINE', 'SUPPORT_TICKET'

  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @IsOptional()
  oldData?: Record<string, unknown>;

  @IsOptional()
  newData?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class QueryAuditLogsDto {
  @IsString()
  @IsNotEmpty()
  actorId!: string;

  @IsString()
  @IsOptional()
  role?: string; // 'CUSTOMER' or 'PROVIDER'

  @IsString()
  @IsOptional()
  entityType?: string;

  @IsString()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  action?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
