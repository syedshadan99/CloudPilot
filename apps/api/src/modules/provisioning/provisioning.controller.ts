import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
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
export class ProvisioningController {
  constructor(private readonly service: ProvisioningService) {}

  @Post("jobs")
  createJob(@Body() dto: CreateProvisioningJobDto) {
    return this.service.createJob(dto);
  }

  @Get("jobs/:id")
  getJob(@Param("id") id: string) {
    return this.service.getJobById(id);
  }

  @Get("orders/:orderId")
  getByOrder(@Param("orderId") orderId: string) {
    return this.service.getJobByOrder(orderId);
  }
}
