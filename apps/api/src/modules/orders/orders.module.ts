import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module.js";
import { DatabaseModule } from "../../database/database.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { OffersModule } from "../offers/offers.module.js";
import { NegotiationRepository } from "../negotiation/negotiation.repository.js";
import { OfferConfirmationController, OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({ imports: [DatabaseModule, IdentityModule, OffersModule, AuditModule], controllers: [OfferConfirmationController, OrdersController], providers: [OrdersService, NegotiationRepository], exports: [OrdersService] })
export class OrdersModule {}
