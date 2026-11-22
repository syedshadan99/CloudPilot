import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module.js";
import { DatabaseModule } from "../../database/database.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { CapacityController } from "./controllers/capacity.controller.js";
import { CustomerCatalogController, ProviderCatalogController } from "./controllers/catalog.controller.js";
import { CatalogRepository } from "./repositories/catalog.repository.js";
import { CapacityService } from "./services/capacity.service.js";
import { CatalogService } from "./services/catalog.service.js";

@Module({
  imports: [DatabaseModule, IdentityModule, AuditModule],
  controllers: [CustomerCatalogController, ProviderCatalogController, CapacityController],
  providers: [CatalogRepository, CatalogService, CapacityService],
  exports: [CatalogRepository, CatalogService, CapacityService],
})
export class CatalogModule {}
