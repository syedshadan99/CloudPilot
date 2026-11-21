import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { VmsRepository } from "./vms.repository.js";
import { VmsService } from "./vms.service.js";
import { VmsController } from "./vms.controller.js";

@Module({
  imports: [DatabaseModule],
  providers: [VmsRepository, VmsService],
  controllers: [VmsController],
  exports: [VmsService, VmsRepository],
})
export class VmsModule {}
