import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module.js";
import { DatabaseModule } from "../../database/database.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { PricingModule } from "../pricing/pricing.module.js";
import { OffersModule } from "../offers/offers.module.js";
import { NegotiationController } from "./negotiation.controller.js";
import { NegotiationService } from "./negotiation.service.js";

@Module({
  imports: [DatabaseModule, IdentityModule, PricingModule, AuditModule, OffersModule],
  controllers: [NegotiationController],
  providers: [NegotiationService],
  exports: [NegotiationService],
})
export class NegotiationModule {}
