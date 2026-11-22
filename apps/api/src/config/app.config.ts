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
  session: {
    ttlSeconds: number;
    idleSeconds: number;
    cookieName: string;
    secure: boolean;
    sameSite: "strict" | "lax" | "none";
  };
  csrfSecret: string;
  passwordBcryptRounds: number;
  verificationTokenTtlSeconds: number;
  passwordResetTokenTtlSeconds: number;
  emailDeliveryMode: "capture" | "disabled";
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
    session: {
      ttlSeconds: configService.get("SESSION_TTL_SECONDS"),
      idleSeconds: configService.get("SESSION_IDLE_SECONDS"),
      cookieName: configService.get("SESSION_COOKIE_NAME"),
      secure: configService.get("SESSION_COOKIE_SECURE") === "true",
      sameSite: configService.get("SESSION_COOKIE_SAME_SITE"),
    },
    csrfSecret: configService.get("CSRF_SECRET"),
    passwordBcryptRounds: configService.get("PASSWORD_BCRYPT_ROUNDS"),
    verificationTokenTtlSeconds: configService.get("VERIFICATION_TOKEN_TTL_SECONDS"),
    passwordResetTokenTtlSeconds: configService.get("PASSWORD_RESET_TOKEN_TTL_SECONDS"),
    emailDeliveryMode: configService.get("EMAIL_DELIVERY_MODE"),
  }),
  inject: [ConfigService],
};
