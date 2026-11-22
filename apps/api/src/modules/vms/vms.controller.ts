import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { VmsService } from "./vms.service.js";

@Controller("vms")
@Roles("customer")
export class VmsController {
  constructor(private readonly vms: VmsService) {}

  /** GET /api/v1/vms?customerId=... */
  @Get()
  listForCustomer(@Query("customerId") _customerId: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.vms.listForCustomer(user.userId);
  }

  /** GET /api/v1/vms/:id?customerId=... */
  @Get(":id")
  getVm(@Param("id") id: string, @Query("customerId") _customerId: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.vms.getVm(id, user.userId);
  }

  /** POST /api/v1/vms/:id/start  body: { customerId } */
  @Post(":id/start")
  start(@Param("id") id: string, @Body("customerId") _customerId: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.vms.start(id, user.userId);
  }

  /** POST /api/v1/vms/:id/stop */
  @Post(":id/stop")
  stop(@Param("id") id: string, @Body("customerId") _customerId: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.vms.stop(id, user.userId);
  }

  /** POST /api/v1/vms/:id/restart */
  @Post(":id/restart")
  restart(@Param("id") id: string, @Body("customerId") _customerId: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.vms.restart(id, user.userId);
  }

  /** POST /api/v1/vms/:id/terminate */
  @Post(":id/terminate")
  terminate(@Param("id") id: string, @Body("customerId") _customerId: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.vms.terminate(id, user.userId);
  }
}
