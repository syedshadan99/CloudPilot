import { Logger } from "@nestjs/common";
import type {
  VirtualMachineProvider,
  VmConfig,
  ProvisionRequest,
  ProvisionResult,
  CapacityCheckResult,
} from "./vm-provider.interface.js";

/**
 * Simulated VM provider — no real cloud, no credentials, no network calls.
 *
 * Generates deterministic hostnames and IPs from the job ID so results are
 * reproducible in tests and demos. Simulates the provisioning stages with
 * lightweight async pauses (configurable, defaults to 0 in test mode).
 *
 * Replace with a real VirtualMachineProvider implementation when a cloud
 * adapter is approved in the architecture decision register.
 */
export class SimulatedVmProvider implements VirtualMachineProvider {
  private readonly logger = new Logger(SimulatedVmProvider.name);

  /**
   * Simulated resource ceiling. All requests succeed unless this limit is hit.
   * In a real provider this would query live capacity APIs.
   */
  private static readonly MAX_CONCURRENT_VMS = 50;

  /** Stage pause in ms — set to 0 in tests via constructor argument. */
  constructor(private readonly stageDelayMs = 200) {}

  async checkCapacity(config: VmConfig): Promise<CapacityCheckResult> {
    // Simulated capacity: reject configs that exceed obvious per-VM limits.
    if (config.cpuCores > 64) {
      return { available: false, reason: "Requested CPU cores exceed maximum (64)" };
    }
    if (config.ramGb > 512) {
      return { available: false, reason: "Requested RAM exceeds maximum (512 GB)" };
    }
    if (config.storageGb > 10240) {
      return { available: false, reason: "Requested storage exceeds maximum (10 TB)" };
    }

    this.logger.debug(
      `Capacity check OK: ${config.cpuCores} vCPU / ${config.ramGb} GB RAM / ${config.storageGb} GB disk / ${config.os}`,
    );
    return { available: true };
  }

  async provision(request: ProvisionRequest): Promise<ProvisionResult> {
    this.logger.log(`Simulating provisioning for job ${request.jobId}`);

    // Simulate each stage with a small async pause so the status updates are
    // observable in the job_attempts log without blocking the event loop.
    const stages = [
      "ALLOCATING",
      "PREPARING_OS",
      "ASSIGNING_NETWORK",
      "BOOTING",
      "HEALTH_CHECK",
    ] as const;

    for (const stage of stages) {
      this.logger.debug(`Job ${request.jobId} → ${stage}`);
      await this.pause();
    }

    // Deterministic identifiers derived from jobId so they are stable across
    // retries and reproducible in integration tests.
    const shortId = request.jobId.replace(/-/g, "").slice(0, 8);
    const simulatedVmId = `sim-vm-${shortId}`;
    const hostname = `${simulatedVmId}.sim.cloudpilot.local`;
    const ipAddress = this.deriveIp(request.jobId);

    this.logger.log(
      `Provisioning complete: ${simulatedVmId} at ${ipAddress} (${hostname})`,
    );

    return { simulatedVmId, hostname, ipAddress };
  }

  /**
   * Derives a stable 10.x.x.x address from the job UUID for reproducibility.
   * Not routable — purely for simulation display.
   */
  private deriveIp(jobId: string): string {
    const hex = jobId.replace(/-/g, "");
    const a = parseInt(hex.slice(0, 2), 16) % 256;
    const b = parseInt(hex.slice(2, 4), 16) % 256;
    const c = parseInt(hex.slice(4, 6), 16) % 256;
    return `10.${a}.${b}.${c}`;
  }

  private pause(): Promise<void> {
    if (this.stageDelayMs === 0) return Promise.resolve();
    return new Promise((res) => setTimeout(res, this.stageDelayMs));
  }
}
