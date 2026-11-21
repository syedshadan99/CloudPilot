import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum TicketStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  WAITING_ON_CUSTOMER = "WAITING_ON_CUSTOMER",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;
}

export class AddTicketMessageDto {
  @IsString()
  @IsNotEmpty()
  senderId!: string;

  @IsString()
  @IsNotEmpty()
  senderRole!: string; // 'CUSTOMER' or 'PROVIDER'

  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class UpdateTicketStatusDto {
  @IsString()
  @IsNotEmpty()
  actorId!: string;

  @IsString()
  @IsNotEmpty()
  actorRole!: string; // 'CUSTOMER' or 'PROVIDER'

  @IsEnum(TicketStatus)
  status!: TicketStatus;

  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}

export class AssignTicketDto {
  @IsString()
  @IsNotEmpty()
  providerId!: string;

  @IsString()
  @IsNotEmpty()
  assignedTo!: string;
}
