import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { ProvisioningService } from "./provisioning.service.js";
import { CreateProvisioningJobDto } from "./dto/index.js";

/**
 * Provisioning endpoints — all versioned under /api/v1/provisioning
 *
 * POST /api/v1/provisioning/jobs
 *   Create a provisioning job for a verified order. Idempotent.
 *
 * GET  /api/v1/provisioning/jobs/:id
 *   Get job status + attempt history by job ID.
 *
 * GET  /api/v1/provisioning/orders/:orderId
 *   Get the provisioning job and progress for a given order.
 */
@Controller("provisioning")
@Roles("provider_admin", "provider_staff")
export class ProvisioningController {
  constructor(private readonly service: ProvisioningService) {}

  @Post("jobs")
  createJob(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: CreateProvisioningJobDto) {
    return this.service.createJob(user, dto);
  }

  @Get("jobs/:id")
  getJob(@CurrentUser() user: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.service.getJobById(user, id);
  }

  @Get("orders/:orderId")
  getByOrder(@CurrentUser() user: AuthenticatedPrincipal, @Param("orderId") orderId: string) {
    return this.service.getJobByOrder(user, orderId);
  }
}
