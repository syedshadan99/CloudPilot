import { Controller, Get, Param, Query } from "@nestjs/common";
import { UsageService } from "./usage.service.js";
import { VmsService } from "../vms/vms.service.js";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";

@Controller("vms")
@Roles("customer")
export class UsageController {
  constructor(
    private readonly usage: UsageService,
    private readonly vms: VmsService,
  ) {}

  /** GET /api/v1/vms/:id/usage?customerId=... */
  @Get(":id/usage")
  getUsage(
    @Param("id") id: string,
    @Query("customerId") _customerId: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query("limit") limit?: string,
  ) {
    return this.usage.getUsage(id, user.userId, limit ? Number(limit) : 48);
  }

  /** GET /api/v1/vms/:id/events?customerId=... */
  @Get(":id/events")
  getEvents(@Param("id") id: string, @Query("customerId") _customerId: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.vms.getVm(id, user.userId).then((r) => r.events);
  }
}
