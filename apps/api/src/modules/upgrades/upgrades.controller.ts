import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { UpgradesService } from "./upgrades.service.js";
import {
  CreateUpgradeRequestDto,
  ConfirmUpgradeRequestDto,
  ApproveUpgradeRequestDto,
  RejectUpgradeRequestDto,
} from "./dto/upgrade-request.dto.js";

@Controller()
export class UpgradesController {
  constructor(private readonly upgrades: UpgradesService) {}

  /**
   * POST /api/v1/vms/:id/upgrade-requests
   * Customer initiates an upgrade/downgrade/resize request.
   */
  @Post("vms/:id/upgrade-requests")
  requestUpgrade(
    @Param("id") vmId: string,
    @Body() dto: CreateUpgradeRequestDto,
  ) {
    return this.upgrades.requestUpgrade(vmId, dto);
  }

  /**
   * GET /api/v1/vms/:id/upgrade-requests?customerId=...
   * List upgrade requests for a specific VM.
   */
  @Get("vms/:id/upgrade-requests")
  listForVm(
    @Param("id") vmId: string,
    @Query("customerId") customerId: string,
  ) {
    return this.upgrades.listByVm(vmId, customerId);
  }

  /**
   * GET /api/v1/upgrade-requests/:id
   * Get an upgrade request by ID.
   */
  @Get("upgrade-requests/:id")
  getById(@Param("id") id: string) {
    return this.upgrades.getById(id);
  }

  /**
   * POST /api/v1/upgrade-requests/:id/confirm
   * Customer confirms intention/quote.
   */
  @Post("upgrade-requests/:id/confirm")
  confirmUpgrade(
    @Param("id") id: string,
    @Body() dto: ConfirmUpgradeRequestDto,
  ) {
    return this.upgrades.confirmUpgrade(id, dto.customerId);
  }

  /**
   * POST /api/v1/upgrade-requests/:id/approve
   * Provider approves the upgrade request.
   */
  @Post("upgrade-requests/:id/approve")
  approveUpgrade(
    @Param("id") id: string,
    @Body() dto: ApproveUpgradeRequestDto,
  ) {
    return this.upgrades.approveUpgrade(id, dto);
  }

  /**
   * POST /api/v1/upgrade-requests/:id/reject
   * Provider rejects the upgrade request.
   */
  @Post("upgrade-requests/:id/reject")
  rejectUpgrade(
    @Param("id") id: string,
    @Body() dto: RejectUpgradeRequestDto,
  ) {
    return this.upgrades.rejectUpgrade(id, dto);
  }
}
