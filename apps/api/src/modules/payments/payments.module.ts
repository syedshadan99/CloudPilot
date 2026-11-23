import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module.js";
import { DatabaseModule } from "../../database/database.module.js";
import { NegotiationRepository } from "../negotiation/negotiation.repository.js";
import { PaymentsController, InvoicePaymentsController } from "./payments.controller.js";
import { PaymentsService } from "./payments.service.js";

@Module({ imports: [DatabaseModule, AuditModule], controllers: [PaymentsController, InvoicePaymentsController], providers: [PaymentsService, NegotiationRepository], exports: [PaymentsService] })
export class PaymentsModule {}
