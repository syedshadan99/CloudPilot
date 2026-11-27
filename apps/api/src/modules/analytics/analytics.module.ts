import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { ProviderModule } from "../provider/provider.module.js";
import { AnalyticsController } from "./analytics.controller.js";
import { AnalyticsService } from "./analytics.service.js";

@Module({ imports: [IdentityModule, ProviderModule], controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
