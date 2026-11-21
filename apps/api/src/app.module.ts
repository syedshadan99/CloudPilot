import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/index.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { ChatModule } from "./modules/chat/chat.module.js";
import { ProvisioningModule } from "./modules/provisioning/provisioning.module.js";
import { VmsModule } from "./modules/vms/vms.module.js";
import { UsageModule } from "./modules/usage/usage.module.js";

@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule, ChatModule, ProvisioningModule, VmsModule, UsageModule],
})
export class AppModule {}
