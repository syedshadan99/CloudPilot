import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/index.js";
import { DatabaseModule } from "../database/database.module.js";
import { ProvisioningModule } from "../modules/provisioning/provisioning.module.js";
import { JobPollerService } from "./job-poller.service.js";

/**
 * Root module for the background worker process.
 * Does NOT start an HTTP server — purely a job runner.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule, ProvisioningModule],
  providers: [JobPollerService],
})
export class WorkerModule {}
