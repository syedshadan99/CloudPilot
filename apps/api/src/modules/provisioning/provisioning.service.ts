import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ProvisioningRepository } from "./provisioning.repository.js";
import { VM_PROVIDER, type VirtualMachineProvider } from "./adapters/index.js";
import type { CreateProvisioningJobDto } from "./dto/index.js";

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly repo: ProvisioningRepository,
    @Inject(VM_PROVIDER) private readonly vmProvider: VirtualMachineProvider,
  ) {}

  // ── Job creation ─────────────────────────────────────────────────────────

  /**
   * Create (or return) a provisioning job for an order.
   *
   * Rules enforced:
   *  1. Payment must be verified before provisioning can start.
   *     (Stub until CP-06 delivers payment_records table.)
   *  2. Simulated capacity must be available.
   *  3. UNIQUE(order_id) on the DB table makes this idempotent —
   *     repeated calls return the existing job without creating duplicates.
   */
  async createJob(dto: CreateProvisioningJobDto) {
    // ── 1. Payment gate ───────────────────────────────────────────────────
    const paymentVerified = await this.isPaymentVerified(dto.orderId);
    if (!paymentVerified) {
      throw new BadRequestException(
        "Payment for this order has not been verified. " +
        "Provisioning cannot start until payment is confirmed.",
      );
    }

    // ── 2. Capacity check ─────────────────────────────────────────────────
    const capacity = await this.vmProvider.checkCapacity(dto.vmConfig);
    if (!capacity.available) {
      throw new BadRequestException(
        `Insufficient capacity: ${capacity.reason ?? "no capacity available"}`,
      );
    }

    // ── 3. Create (idempotent) ────────────────────────────────────────────
    const job = await this.repo.createJob(dto.orderId, dto.customerId, dto.vmConfig);

    this.logger.log(
      `Provisioning job ${job.id} created for order ${dto.orderId} (status: ${job.status})`,
    );
    return job;
  }

  // ── Status / progress ────────────────────────────────────────────────────

  async getJobByOrder(orderId: string) {
    const job = await this.repo.findByOrderId(orderId);
    if (!job) throw new NotFoundException(`No provisioning job found for order ${orderId}`);
    const attempts = await this.repo.listAttempts(job.id);
    return { job, attempts };
  }

  async getJobById(jobId: string) {
    const job = await this.repo.findById(jobId);
    if (!job) throw new NotFoundException(`Provisioning job ${jobId} not found`);
    const attempts = await this.repo.listAttempts(jobId);
    return { job, attempts };
  }

  // ── Worker: process one job ───────────────────────────────────────────────

  /**
   * Called by the worker on each polling tick.
   * Picks up QUEUED jobs and runs the full provisioning sequence.
   * Safe to call concurrently — the DB UNIQUE constraint + status check
   * prevents duplicate processing.
   */
  async processNextBatch(): Promise<void> {
    const jobs = await this.repo.listPickable(5);
    await Promise.all(jobs.map((j) => this.runJob(j.id)));
  }

  private async runJob(jobId: string): Promise<void> {
    const job = await this.repo.findById(jobId);
    if (!job || job.status !== "QUEUED") return; // already picked up

    const attemptNumber = job.attempt_count + 1;
    this.logger.log(`Running job ${jobId} (attempt ${attemptNumber}/${job.max_attempts})`);

    // Mark as ALLOCATING + record start time
    await this.repo.updateStatus(jobId, "ALLOCATING", { started_at: new Date() });

    try {
      const result = await this.vmProvider.provision({
        jobId,
        orderId: job.order_id,
        customerId: job.customer_id,
        config: job.vm_config,
      });

      await this.repo.updateStatus(jobId, "READY", {
        simulated_vm_id: result.simulatedVmId,
        simulated_host: result.hostname,
        simulated_ip: result.ipAddress,
        completed_at: new Date(),
      });

      await this.repo.recordAttempt(jobId, attemptNumber, "READY");
      this.logger.log(`Job ${jobId} completed → ${result.simulatedVmId}`);
    } catch (err) {
      const error = (err as Error).message ?? String(err);
      this.logger.warn(`Job ${jobId} failed on attempt ${attemptNumber}: ${error}`);

      await this.repo.recordAttempt(jobId, attemptNumber, "FAILED", error);

      const refreshed = await this.repo.findById(jobId);
      const exhausted = refreshed
        ? refreshed.attempt_count >= refreshed.max_attempts
        : true;

      if (exhausted) {
        await this.repo.updateStatus(jobId, "FAILED", {
          last_error: error,
          completed_at: new Date(),
        });
        this.logger.error(`Job ${jobId} permanently failed after ${attemptNumber} attempts`);
      } else {
        // Reset to QUEUED for retry on next polling tick
        await this.repo.updateStatus(jobId, "QUEUED", { last_error: error });
      }
    }
  }

  // ── Payment gate stub ─────────────────────────────────────────────────────

  /**
   * Verifies that payment for the order is confirmed before provisioning.
   *
   * TODO CP-06: Replace the stub with a real query once the payment_records
   * table exists:
   *   SELECT EXISTS(
   *     SELECT 1 FROM payment_records
   *     WHERE order_id = $orderId AND status = 'VERIFIED'
   *   )
   *
   * The stub returns true so the provisioning worker can be developed and
   * tested end-to-end without the payment module being complete.
   */
  private async isPaymentVerified(_orderId: string): Promise<boolean> {
    // STUB — always returns true during development.
    // Replace with real DB check when CP-06 is merged.
    return true;
  }
}
