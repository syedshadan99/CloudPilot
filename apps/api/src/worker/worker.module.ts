import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/index.js";
import { DatabaseModule } from "../database/database.module.js";
import { ProvisioningModule } from "../modules/provisioning/provisioning.module.js";
import { JobPollerService } from "./job-poller.service.js";
import { OffersModule } from "../modules/offers/offers.module.js";
import { OfferExpiryPollerService } from "./offer-expiry-poller.service.js";
import { BillingModule } from "../modules/billing/billing.module.js";
import { BillingPollerService } from "./billing-poller.service.js";

/**
 * Root module for the background worker process.
 * Does NOT start an HTTP server — purely a job runner.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule, ProvisioningModule, OffersModule, BillingModule],
  providers: [JobPollerService, OfferExpiryPollerService, BillingPollerService],
})
export class WorkerModule {}
