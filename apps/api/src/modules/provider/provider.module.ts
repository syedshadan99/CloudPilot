import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module.js";
import { DatabaseModule } from "../../database/database.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { PricingModule } from "../pricing/pricing.module.js";
import { ProviderController } from "./provider.controller.js";
import { ProviderRepository } from "./provider.repository.js";
import { ProviderService } from "./provider.service.js";

@Module({
  imports: [DatabaseModule, IdentityModule, AuditModule, PricingModule],
  controllers: [ProviderController],
  providers: [ProviderRepository, ProviderService],
  exports: [ProviderRepository, ProviderService],
})
export class ProviderModule {}
