import { type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "./env.validation.js";

/**
 * Strongly-typed application configuration derived from validated
 * environment variables.  Inject `AppConfig` in any service or controller.
 */
export interface AppConfig {
  /** Current runtime environment */
  env: string;
  /** HTTP listen port */
  port: number;
  /** HTTP bind address */
  host: string;
  /** PostgreSQL connection */
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  /** Allowed CORS origin for local development */
  corsOrigin: string;
}

export const APP_CONFIG = Symbol("APP_CONFIG");

export const appConfigProvider: Provider = {
  provide: APP_CONFIG,
  useFactory: (configService: ConfigService<EnvironmentVariables, true>): AppConfig => ({
    env: configService.get("NODE_ENV"),
    port: configService.get("API_PORT"),
    host: configService.get("API_HOST"),
    database: {
      host: configService.get("PGHOST"),
      port: configService.get("PGPORT"),
      name: configService.get("PGDATABASE"),
      user: configService.get("PGUSER"),
      password: configService.get("PGPASSWORD"),
    },
    corsOrigin: configService.get("CORS_ORIGIN"),
  }),
  inject: [ConfigService],
};
