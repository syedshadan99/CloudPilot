import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { ProvisioningController } from "./provisioning.controller.js";
import { ProvisioningService } from "./provisioning.service.js";
import { ProvisioningRepository } from "./provisioning.repository.js";
import { VM_PROVIDER } from "./adapters/index.js";
import { SimulatedVmProvider } from "./adapters/simulated-vm.provider.js";

@Module({
  imports: [DatabaseModule],
  controllers: [ProvisioningController],
  providers: [
    ProvisioningService,
    ProvisioningRepository,
    {
      provide: VM_PROVIDER,
      useClass: SimulatedVmProvider,
    },
  ],
  exports: [ProvisioningService, VM_PROVIDER],
})
export class ProvisioningModule {}
