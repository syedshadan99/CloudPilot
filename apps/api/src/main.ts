import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./common/filters/index.js";
import { RequestLoggerInterceptor } from "./common/interceptors/index.js";
import type { EnvironmentVariables } from "./config/index.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");
  const configService = app.get(ConfigService<EnvironmentVariables, true>);

  const port = configService.get("API_PORT");
  const host = configService.get("API_HOST");
  const corsOrigin = configService.get("CORS_ORIGIN");

  // ── API versioning ─────────────────────────────────────────────
  // All future domain routes use URI versioning under /api/v1/*.
  // Health endpoints are excluded from the prefix so they remain at
  // /health and /health/db for container probes and load balancers.
  app.setGlobalPrefix("api", {
    exclude: ["health", "health/db"],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  // ── CORS ───────────────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-CSRF-Token"],
  });

  // ── Global pipes ───────────────────────────────────────────────
  // Validates incoming DTOs via class-validator decorators.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global filters and interceptors ────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggerInterceptor());

  // ── Shutdown hooks ─────────────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port, host);
  logger.log(`API listening on http://${host}:${port}/api/v1`);
}

bootstrap();
