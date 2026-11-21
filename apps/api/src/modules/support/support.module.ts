import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { SupportRepository } from "./support.repository.js";
import { SupportService } from "./support.service.js";
import { SupportController } from "./support.controller.js";

@Module({
  imports: [DatabaseModule],
  controllers: [SupportController],
  providers: [SupportRepository, SupportService],
  exports: [SupportService, SupportRepository],
})
export class SupportModule {}
