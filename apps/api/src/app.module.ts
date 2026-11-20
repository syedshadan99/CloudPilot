import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/index.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { ChatModule } from "./modules/chat/chat.module.js";

@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule, ChatModule],
})
export class AppModule {}
