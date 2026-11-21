import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { VmsRepository } from "./vms.repository.js";
import { resolveTransition, type VmAction } from "./vm-state-machine.js";

@Injectable()
export class VmsService {
  private readonly logger = new Logger(VmsService.name);

  constructor(private readonly repo: VmsRepository) {}

  // ── Queries ───────────────────────────────────────────────────────────────

  async listForCustomer(customerId: string) {
    return this.repo.listByCustomer(customerId);
  }

  async getVm(vmId: string, customerId: string) {
    const vm = await this.findAndAuthorise(vmId, customerId);
    const events = await this.repo.listEvents(vmId);
    return { vm, events };
  }

  // ── Lifecycle actions ─────────────────────────────────────────────────────

  async start(vmId: string, customerId: string) {
    return this.applyAction(vmId, customerId, "START");
  }

  async stop(vmId: string, customerId: string) {
    return this.applyAction(vmId, customerId, "STOP");
  }

  async restart(vmId: string, customerId: string) {
    return this.applyAction(vmId, customerId, "RESTART");
  }

  async terminate(vmId: string, customerId: string) {
    return this.applyAction(vmId, customerId, "TERMINATE");
  }

  // ── VM creation (called from provisioning when job reaches READY) ─────────

  /**
   * Register a VM once provisioning completes. Idempotent via
   * UNIQUE(simulated_vm_id) + ON CONFLICT DO UPDATE in the repository.
   */
  async registerFromProvisioning(params: {
    customerId: string;
    provisioningJobId: string;
    simulatedVmId: string;
    hostname: string;
    ipAddress: string;
    vmConfig: Record<string, unknown>;
  }) {
    const vm = await this.repo.create(params);
    this.logger.log(`VM registered: ${vm.id} (${vm.simulated_vm_id}) for customer ${params.customerId}`);
    return vm;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async findAndAuthorise(vmId: string, customerId: string) {
    const vm = await this.repo.findById(vmId);
    if (!vm) throw new NotFoundException(`VM ${vmId} not found`);
    if (vm.customer_id !== customerId) {
      throw new ForbiddenException("You do not own this VM");
    }
    return vm;
  }

  private async applyAction(vmId: string, customerId: string, action: VmAction) {
    const vm = await this.findAndAuthorise(vmId, customerId);
    const nextState = resolveTransition(vm.state, action);

    if (!nextState) {
      throw new BadRequestException(
        `Action '${action}' is not allowed when VM is in state '${vm.state}'`,
      );
    }

    // Timestamps to update alongside state
    const timestamps: Record<string, Date | null> = {};
    if (nextState === "RUNNING")    timestamps["started_at"]    = new Date();
    if (nextState === "STOPPING")   timestamps["stopped_at"]    = null;        // clear previous
    if (nextState === "STOPPED")    timestamps["stopped_at"]    = new Date();
    if (nextState === "TERMINATED") timestamps["terminated_at"] = new Date();

    const updated = await this.repo.updateState(vmId, nextState, timestamps);

    await this.repo.recordEvent({
      vmId,
      actorId: customerId,
      fromState: vm.state,
      toState: nextState,
      action,
    });

    this.logger.log(`VM ${vmId}: ${vm.state} → ${nextState} (${action}) by ${customerId}`);
    return updated;
  }
}
