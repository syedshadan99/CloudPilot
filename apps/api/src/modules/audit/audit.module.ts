import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { AuditRepository } from "./audit.repository.js";
import { AuditService } from "./audit.service.js";
import { AuditController } from "./audit.controller.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AuditController],
  providers: [AuditRepository, AuditService],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
