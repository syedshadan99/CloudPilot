import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/index.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { ChatModule } from "./modules/chat/chat.module.js";
import { ProvisioningModule } from "./modules/provisioning/provisioning.module.js";
import { VmsModule } from "./modules/vms/vms.module.js";
import { UsageModule } from "./modules/usage/usage.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { OnboardingModule } from "./modules/onboarding/onboarding.module.js";
import { AuditModule } from "./common/audit/audit.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { PricingModule } from "./modules/pricing/pricing.module.js";

@Module({
  imports: [AppConfigModule, DatabaseModule, AuditModule, IdentityModule, OnboardingModule, CatalogModule, PricingModule, HealthModule, ChatModule, ProvisioningModule, VmsModule, UsageModule],
})
export class AppModule {}
