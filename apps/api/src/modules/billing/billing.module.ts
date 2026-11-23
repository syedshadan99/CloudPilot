import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { OrdersModule } from "../orders/orders.module.js";
import { BillingController } from "./billing.controller.js";
import { BillingService } from "./billing.service.js";

@Module({ imports: [DatabaseModule, IdentityModule, OrdersModule], controllers: [BillingController], providers: [BillingService], exports: [BillingService] })
export class BillingModule {}
