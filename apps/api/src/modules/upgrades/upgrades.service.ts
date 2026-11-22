import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { UpgradesRepository, type UpgradeRequestRow } from "./upgrades.repository.js";
import { VmsRepository } from "../vms/vms.repository.js";
import { VM_PROVIDER, type VirtualMachineProvider } from "../provisioning/adapters/index.js";
import {
  calculateMonthlyPrice,
  calculatePriceDifference,
  type VmSpec,
} from "./pricing-calculator.js";
import {
  validateConfigurationChange,
  validateStorageSafety,
} from "./upgrade-validator.js";
import type {
  CreateUpgradeRequestDto,
  ApproveUpgradeRequestDto,
  RejectUpgradeRequestDto,
} from "./dto/upgrade-request.dto.js";

@Injectable()
export class UpgradesService {
  private readonly logger = new Logger(UpgradesService.name);

  constructor(
    private readonly repo: UpgradesRepository,
    private readonly vmsRepo: VmsRepository,
    @Inject(VM_PROVIDER) private readonly vmProvider: VirtualMachineProvider,
  ) {}

  // ── Customer: Request an Upgrade / Downgrade ──────────────────────────────

  async requestUpgrade(vmId: string, dto: CreateUpgradeRequestDto): Promise<UpgradeRequestRow> {
    const vm = await this.vmsRepo.findById(vmId);
    if (!vm) throw new NotFoundException(`VM ${vmId} not found`);

    if (vm.customer_id !== dto.customerId) {
      throw new ForbiddenException("You do not own this VM");
    }

    // VM must be in a stable state (RUNNING or STOPPED)
    if (vm.state !== "RUNNING" && vm.state !== "STOPPED") {
      throw new BadRequestException(
        `Cannot request resize while VM is in '${vm.state}' state. VM must be RUNNING or STOPPED.`,
      );
    }

    // Check for duplicate active request
    const existing = await this.repo.findActiveByVmId(vmId);
    if (existing) {
      throw new ConflictException(
        `An active upgrade request (${existing.id}) already exists for this VM in state '${existing.status}'.`,
      );
    }

    const currentConfig = (vm.vm_config || {}) as Record<string, unknown>;
    const oldSpec: VmSpec = {
      cpuCores: Number(currentConfig["cpuCores"] ?? currentConfig["cpu"] ?? 1),
      ramGb: Number(currentConfig["ramGb"] ?? currentConfig["ram"] ?? 1),
      storageGb: Number(currentConfig["storageGb"] ?? currentConfig["storage"] ?? 10),
    };

    const newSpec: VmSpec = {
      cpuCores: dto.cpuCores,
      ramGb: dto.ramGb,
      storageGb: dto.storageGb,
    };

    // 1. Validate spec change and ranges
    validateConfigurationChange(oldSpec, newSpec);

    // 2. Validate storage safety (no shrinking)
    validateStorageSafety(oldSpec, newSpec);

    // 3. Check capacity on provider
    const os = (currentConfig["os"] as string) || "Linux";
    const capacity = await this.vmProvider.checkCapacity({
      ...newSpec,
      os,
    });
    if (!capacity.available) {
      throw new BadRequestException(
        `Capacity check failed: ${capacity.reason ?? "Insufficient capacity"}`,
      );
    }

    // 4. Calculate prices
    const oldMonthlyPrice = calculateMonthlyPrice(oldSpec);
    const newMonthlyPrice = calculateMonthlyPrice(newSpec);
    const priceDifference = calculatePriceDifference(oldSpec, newSpec);

    // 5. Persist request
    const request = await this.repo.create({
      customerId: dto.customerId,
      vmId,
      oldConfig: { ...oldSpec, os },
      newConfig: { ...newSpec, os },
      oldMonthlyPrice,
      newMonthlyPrice,
      priceDifference,
    });

    this.logger.log(
      `Upgrade request ${request.id} created for VM ${vmId} by customer ${dto.customerId} (price diff: $${priceDifference}/mo)`,
    );

    return request;
  }

  // ── Customer: Confirm Upgrade Request ─────────────────────────────────────

  async confirmUpgrade(requestId: string, customerId: string): Promise<UpgradeRequestRow> {
    const req = await this.repo.findById(requestId);
    if (!req) throw new NotFoundException(`Upgrade request ${requestId} not found`);

    if (req.customer_id !== customerId) {
      throw new ForbiddenException("You do not own this upgrade request");
    }

    if (req.status === "COMPLETED" || req.status === "RESIZING") {
      return req;
    }

    if (req.status === "REJECTED" || req.status === "CANCELLED" || req.status === "FAILED") {
      throw new BadRequestException(`Cannot confirm an upgrade request in '${req.status}' state`);
    }

    // Idempotent update
    const updated = await this.repo.updateStatus(requestId, req.status, {
      customer_confirmed_at: new Date(),
    });

    // If provider has already approved, execute the resize job
    if (updated.provider_approved_at) {
      return this.applyResizeJob(updated);
    }

    return updated;
  }

  // ── Provider: Approve Upgrade Request ─────────────────────────────────────

  async approveUpgrade(requestId: string, dto: ApproveUpgradeRequestDto): Promise<UpgradeRequestRow> {
    const req = await this.repo.findById(requestId);
    if (!req) throw new NotFoundException(`Upgrade request ${requestId} not found`);

    // Idempotent: already approved/resizing/completed
    if (req.status === "APPROVED" || req.status === "RESIZING" || req.status === "COMPLETED") {
      return req;
    }

    if (req.status === "REJECTED" || req.status === "CANCELLED" || req.status === "FAILED") {
      throw new BadRequestException(`Cannot approve an upgrade request in '${req.status}' state`);
    }

    const updated = await this.repo.updateStatus(requestId, "APPROVED", {
      provider_approved_at: new Date(),
      approved_by: dto.providerId,
    });

    this.logger.log(`Upgrade request ${requestId} approved by provider ${dto.providerId}`);

    // Since customer confirmed at creation time, both approvals are met: run resize job
    return this.applyResizeJob(updated);
  }

  // ── Provider: Reject Upgrade Request ─────────────────────────────────────

  async rejectUpgrade(requestId: string, dto: RejectUpgradeRequestDto): Promise<UpgradeRequestRow> {
    const req = await this.repo.findById(requestId);
    if (!req) throw new NotFoundException(`Upgrade request ${requestId} not found`);

    if (req.status === "COMPLETED" || req.status === "RESIZING") {
      throw new BadRequestException(`Cannot reject an upgrade request in '${req.status}' state`);
    }

    if (req.status === "REJECTED") {
      return req; // idempotent
    }

    const updated = await this.repo.updateStatus(requestId, "REJECTED", {
      approved_by: dto.providerId,
      rejection_reason: dto.reason ?? "Rejected by provider",
    });

    this.logger.log(`Upgrade request ${requestId} rejected by provider ${dto.providerId}`);
    return updated;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getById(requestId: string): Promise<UpgradeRequestRow> {
    const req = await this.repo.findById(requestId);
    if (!req) throw new NotFoundException(`Upgrade request ${requestId} not found`);
    return req;
  }

  async listByCustomer(customerId: string): Promise<UpgradeRequestRow[]> {
    return this.repo.listByCustomer(customerId);
  }

  async listByVm(vmId: string, customerId: string): Promise<UpgradeRequestRow[]> {
    const vm = await this.vmsRepo.findById(vmId);
    if (!vm) throw new NotFoundException(`VM ${vmId} not found`);
    if (vm.customer_id !== customerId) {
      throw new ForbiddenException("You do not own this VM");
    }
    return this.repo.listByVm(vmId);
  }

  // ── Resize Job Execution with Retry and Rollback ──────────────────────────

  async applyResizeJob(request: UpgradeRequestRow): Promise<UpgradeRequestRow> {
    const vm = await this.vmsRepo.findById(request.vm_id);
    if (!vm) throw new NotFoundException(`VM ${request.vm_id} not found`);

    // Guard: VM must still be in RUNNING or STOPPED state
    const originalState = vm.state;
    if (originalState !== "RUNNING" && originalState !== "STOPPED") {
      throw new BadRequestException(
        `VM ${vm.id} is in '${originalState}' state; cannot apply resize.`,
      );
    }

    // 1. Mark request and VM as RESIZING
    await this.repo.updateStatus(request.id, "RESIZING", { started_at: new Date() });
    await this.vmsRepo.updateState(vm.id, "RESIZING");
    await this.vmsRepo.recordEvent({
      vmId: vm.id,
      actorId: request.approved_by || request.customer_id,
      fromState: originalState,
      toState: "RESIZING",
      action: "RESIZE_START",
      note: `Resize initiated (spec update)`,
    });

    // 2. Execute with bounded retries
    let success = false;
    let lastError = "";

    for (let attempt = 1; attempt <= request.max_attempts; attempt++) {
      try {
        await this.repo.recordAttempt(request.id, attempt);
        this.logger.log(`Applying resize for VM ${vm.id} (attempt ${attempt}/${request.max_attempts})`);

        await this.vmProvider.resize({
          requestId: request.id,
          vmId: vm.id,
          simulatedVmId: vm.simulated_vm_id ?? undefined,
          oldConfig: request.old_configuration as any,
          newConfig: request.new_configuration as any,
        });

        success = true;
        break;
      } catch (err) {
        lastError = (err as Error).message ?? String(err);
        this.logger.warn(`Resize attempt ${attempt} for VM ${vm.id} failed: ${lastError}`);
      }
    }

    if (success) {
      // 3. Success: apply new configuration and restore original VM state
      const mergedConfig = {
        ...(vm.vm_config || {}),
        ...request.new_configuration,
      };

      await this.vmsRepo.updateConfig(vm.id, mergedConfig);
      await this.vmsRepo.updateState(vm.id, originalState);
      await this.vmsRepo.recordEvent({
        vmId: vm.id,
        actorId: request.approved_by || request.customer_id,
        fromState: "RESIZING",
        toState: originalState,
        action: "RESIZE_COMPLETE",
        note: `VM resized successfully to ${request.new_configuration.cpuCores} vCPU / ${request.new_configuration.ramGb} GB RAM / ${request.new_configuration.storageGb} GB disk`,
      });

      const completed = await this.repo.updateStatus(request.id, "COMPLETED", {
        completed_at: new Date(),
      });

      this.logger.log(`Resize job for VM ${vm.id} completed successfully`);
      return completed;
    } else {
      // 4. Failure: ROLLBACK!
      // VM config is left untouched as old_configuration.
      // VM state is restored to original state (RUNNING or STOPPED).
      await this.vmsRepo.updateState(vm.id, originalState);
      await this.vmsRepo.recordEvent({
        vmId: vm.id,
        actorId: request.approved_by || request.customer_id,
        fromState: "RESIZING",
        toState: originalState,
        action: "RESIZE_ROLLED_BACK",
        note: `Resize failed after ${request.max_attempts} attempts. Rolled back configuration. Error: ${lastError}`,
      });

      const failed = await this.repo.updateStatus(request.id, "FAILED", {
        last_error: lastError,
        completed_at: new Date(),
      });

      this.logger.error(`Resize job for VM ${vm.id} permanently failed and was rolled back.`);
      return failed;
    }
  }
}
