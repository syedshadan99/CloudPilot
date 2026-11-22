import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module.js";
import { DatabaseModule } from "../../database/database.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { PolicyController } from "./controllers/policy.controller.js";
import { PricingController } from "./controllers/pricing.controller.js";
import { PricingRepository } from "./repositories/pricing.repository.js";
import { PolicyService } from "./services/policy.service.js";
import { PricingService } from "./services/pricing.service.js";

@Module({
  imports: [DatabaseModule, IdentityModule, CatalogModule, AuditModule],
  controllers: [PricingController, PolicyController],
  providers: [PricingRepository, PricingService, PolicyService],
  exports: [PricingRepository, PricingService, PolicyService],
})
export class PricingModule {}
