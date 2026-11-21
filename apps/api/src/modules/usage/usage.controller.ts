import { Controller, Get, Param, Query } from "@nestjs/common";
import { UsageService } from "./usage.service.js";
import { VmsService } from "../vms/vms.service.js";

@Controller("vms")
export class UsageController {
  constructor(
    private readonly usage: UsageService,
    private readonly vms: VmsService,
  ) {}

  /** GET /api/v1/vms/:id/usage?customerId=... */
  @Get(":id/usage")
  getUsage(
    @Param("id") id: string,
    @Query("customerId") customerId: string,
    @Query("limit") limit?: string,
  ) {
    return this.usage.getUsage(id, customerId, limit ? Number(limit) : 48);
  }

  /** GET /api/v1/vms/:id/events?customerId=... */
  @Get(":id/events")
  getEvents(@Param("id") id: string, @Query("customerId") customerId: string) {
    return this.vms.getVm(id, customerId).then((r) => r.events);
  }
}
