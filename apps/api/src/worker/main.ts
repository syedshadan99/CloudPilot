import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { WorkerModule } from "./worker.module.js";

/**
 * Worker entry point — a separate NestJS process that polls for provisioning
 * jobs and runs them. Start with:
 *   npm run start:worker --workspace=apps/api
 *
 * The worker shares all domain modules with the API but does NOT start an
 * HTTP server. It polls the PostgreSQL jobs table on a fixed interval and
 * processes QUEUED provisioning jobs with bounded retries.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger("Worker");

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ["log", "warn", "error", "debug"],
  });

  app.enableShutdownHooks();
  logger.log("CloudPilot provisioning worker started");
}

bootstrap();
