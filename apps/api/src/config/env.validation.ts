import { plainToInstance } from "class-transformer";
import {
  IsEnum,
  IsInt,
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
  @MinLength(1)
  PGPASSWORD: string = "";

  @IsString()
  CORS_ORIGIN: string = "http://localhost:5173";
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

  return validated;
}
