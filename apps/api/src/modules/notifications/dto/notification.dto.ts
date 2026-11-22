import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export enum NotificationRole {
  CUSTOMER = "CUSTOMER",
  PROVIDER = "PROVIDER",
}

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsEnum(NotificationRole)
  @IsOptional()
  role?: NotificationRole;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class MarkReadDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
