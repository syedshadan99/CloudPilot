import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module.js";
import { DatabaseModule } from "../../database/database.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { NegotiationRepository } from "../negotiation/negotiation.repository.js";
import { OffersController } from "./offers.controller.js";
import { ProviderOffersController } from "./provider-offers.controller.js";
import { OffersService } from "./offers.service.js";

@Module({
  imports: [DatabaseModule, IdentityModule, AuditModule],
  controllers: [OffersController, ProviderOffersController],
  providers: [NegotiationRepository, OffersService],
  exports: [NegotiationRepository, OffersService],
})
export class OffersModule {}
