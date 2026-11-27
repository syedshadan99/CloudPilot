import { Controller, Get, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { ProviderReportQueryDto } from "../provider/dto/provider.dto.js";
import { AnalyticsService } from "./analytics.service.js";

@Controller("provider/analytics")
@Roles("provider_admin", "provider_staff")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}
  @Get("overview") overview(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.analytics.overview(user, query); }
  @Get("revenue") revenue(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.analytics.revenue(user, query); }
  @Get("deals") deals(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.analytics.deals(user, query); }
  @Get("discounts") discounts(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.analytics.discounts(user, query); }
  @Get("vms") vms(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.analytics.vms(user, query); }
  @Get("billing") billing(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.analytics.billing(user, query); }
}
