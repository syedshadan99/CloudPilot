import { plainToInstance } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsIn,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from "class-validator";

export enum Environment {
  Development = "development",
  Production = "production",
  Test = "test",
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT: number = 3000;

  @IsString()
  @MinLength(1)
  API_HOST: string = "127.0.0.1";

  @IsString()
  @MinLength(1)
  PGHOST: string = "127.0.0.1";

  @IsInt()
  @Min(1)
  @Max(65535)
  PGPORT: number = 5432;

  @IsString()
  @MinLength(1)
  PGDATABASE: string = "cloudpilot";

  @IsString()
  @MinLength(1)
  PGUSER: string = "cloudpilot";

  @IsString()
  PGPASSWORD: string = "";

  @IsString()
  CORS_ORIGIN: string = "http://localhost:5173";

  @IsInt()
  @Min(300)
  SESSION_TTL_SECONDS: number = 604800;

  @IsInt()
  @Min(60)
  SESSION_IDLE_SECONDS: number = 86400;

  @IsString()
  @MinLength(1)
  SESSION_COOKIE_NAME: string = "cloudpilot_session";

  @IsIn(["true", "false"])
  SESSION_COOKIE_SECURE: string = "false";

  @IsIn(["strict", "lax", "none"])
  SESSION_COOKIE_SAME_SITE: "strict" | "lax" | "none" = "lax";

  @IsString()
  @MinLength(32)
  CSRF_SECRET: string = "cloudpilot-development-csrf-secret-change-me";

  @IsInt()
  @Min(10)
  @Max(15)
  PASSWORD_BCRYPT_ROUNDS: number = 12;

  @IsInt()
  @Min(300)
  VERIFICATION_TOKEN_TTL_SECONDS: number = 86400;

  @IsInt()
  @Min(300)
  PASSWORD_RESET_TOKEN_TTL_SECONDS: number = 3600;

  @IsIn(["capture", "disabled"])
  EMAIL_DELIVERY_MODE: "capture" | "disabled" = "capture";
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints ?? {}).join(", "))
      .join("\n  ");
    throw new Error(`Environment validation failed:\n  ${messages}`);
  }

  if (validated.NODE_ENV === Environment.Production) {
    if (validated.CSRF_SECRET === "cloudpilot-development-csrf-secret-change-me") {
      throw new Error("CSRF_SECRET must be explicitly configured in production");
    }
    if (validated.SESSION_COOKIE_SECURE !== "true") {
      throw new Error("SESSION_COOKIE_SECURE=true is required in production");
    }
    if (validated.EMAIL_DELIVERY_MODE !== "disabled") {
      throw new Error("A real email delivery adapter must replace capture mode in production");
    }
  }

  if (validated.SESSION_COOKIE_SAME_SITE === "none" && validated.SESSION_COOKIE_SECURE !== "true") {
    throw new Error("SameSite=None session cookies require Secure=true");
  }
  if (validated.SESSION_COOKIE_NAME.startsWith("__Host-") && validated.SESSION_COOKIE_SECURE !== "true") {
    throw new Error("__Host- session cookies require Secure=true");
  }

  return validated;
}
