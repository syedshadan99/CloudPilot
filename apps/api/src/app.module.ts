import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/index.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { ChatModule } from "./modules/chat/chat.module.js";
import { ProvisioningModule } from "./modules/provisioning/provisioning.module.js";
import { VmsModule } from "./modules/vms/vms.module.js";
import { UsageModule } from "./modules/usage/usage.module.js";
import { UpgradesModule } from "./modules/upgrades/upgrades.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";
import { SupportModule } from "./modules/support/support.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    ChatModule,
    ProvisioningModule,
    VmsModule,
    UsageModule,
    UpgradesModule,
    NotificationsModule,
    SupportModule,
    AuditModule,
  ],
})
export class AppModule {}
