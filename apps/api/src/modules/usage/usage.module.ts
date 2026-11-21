import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { VmsModule } from "../vms/vms.module.js";
import { UsageRepository } from "./usage.repository.js";
import { UsageService } from "./usage.service.js";
import { UsageController } from "./usage.controller.js";

@Module({
  imports: [DatabaseModule, VmsModule],
  providers: [UsageRepository, UsageService],
  controllers: [UsageController],
  exports: [UsageService, UsageRepository],
})
export class UsageModule {}
