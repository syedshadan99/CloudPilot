import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { VmsModule } from "../vms/vms.module.js";
import { ProvisioningModule } from "../provisioning/provisioning.module.js";
import { UpgradesRepository } from "./upgrades.repository.js";
import { UpgradesService } from "./upgrades.service.js";
import { UpgradesController } from "./upgrades.controller.js";

@Module({
  imports: [DatabaseModule, VmsModule, ProvisioningModule],
  controllers: [UpgradesController],
  providers: [UpgradesRepository, UpgradesService],
  exports: [UpgradesService, UpgradesRepository],
})
export class UpgradesModule {}
