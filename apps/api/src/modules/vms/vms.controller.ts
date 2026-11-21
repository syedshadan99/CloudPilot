import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { VmsService } from "./vms.service.js";

@Controller("vms")
export class VmsController {
  constructor(private readonly vms: VmsService) {}

  /** GET /api/v1/vms?customerId=... */
  @Get()
  listForCustomer(@Query("customerId") customerId: string) {
    return this.vms.listForCustomer(customerId);
  }

  /** GET /api/v1/vms/:id?customerId=... */
  @Get(":id")
  getVm(@Param("id") id: string, @Query("customerId") customerId: string) {
    return this.vms.getVm(id, customerId);
  }

  /** POST /api/v1/vms/:id/start  body: { customerId } */
  @Post(":id/start")
  start(@Param("id") id: string, @Body("customerId") customerId: string) {
    return this.vms.start(id, customerId);
  }

  /** POST /api/v1/vms/:id/stop */
  @Post(":id/stop")
  stop(@Param("id") id: string, @Body("customerId") customerId: string) {
    return this.vms.stop(id, customerId);
  }

  /** POST /api/v1/vms/:id/restart */
  @Post(":id/restart")
  restart(@Param("id") id: string, @Body("customerId") customerId: string) {
    return this.vms.restart(id, customerId);
  }

  /** POST /api/v1/vms/:id/terminate */
  @Post(":id/terminate")
  terminate(@Param("id") id: string, @Body("customerId") customerId: string) {
    return this.vms.terminate(id, customerId);
  }
}
