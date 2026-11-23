import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { DatabaseService } from "../../database/database.service.js";
import { AuthorizationService } from "../identity/services/authorization.service.js";
import { ProvisioningRepository } from "./provisioning.repository.js";
import { VM_PROVIDER, type VirtualMachineProvider } from "./adapters/index.js";
import type { CreateProvisioningJobDto } from "./dto/index.js";

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly repo: ProvisioningRepository,
    @Inject(VM_PROVIDER) private readonly vmProvider: VirtualMachineProvider,
    private readonly db: DatabaseService,
    private readonly authorization: AuthorizationService,
  ) {}

  // ── Job creation ─────────────────────────────────────────────────────────

  /**
   * Create (or return) a provisioning job for an order.
   *
   * Rules enforced:
   *  1. Payment must be verified before provisioning can start.
   *  2. Simulated capacity must be available.
   *  3. UNIQUE(order_id) on the DB table makes this idempotent —
   *     repeated calls return the existing job without creating duplicates.
   */
  async createJob(user: AuthenticatedPrincipal, dto: CreateProvisioningJobDto) {
    const orderResult = await this.db.query<{ id: string; customer_id: string; organization_id: string; vm_configuration: Record<string, unknown>; status: string }>(
      `SELECT id, customer_id, organization_id, vm_configuration, status FROM orders WHERE id = $1`,
      [dto.orderId],
    );
    const order = orderResult.rows[0];
    if (!order) throw new NotFoundException("Order not found");
    await this.authorization.assertOrganizationMember(user.userId, order.organization_id);

    // ── 1. Payment gate ───────────────────────────────────────────────────
    const paymentVerified = await this.isPaymentVerified(dto.orderId);
    if (!paymentVerified) {
      throw new BadRequestException(
        "Payment for this order has not been verified. " +
        "Provisioning cannot start until payment is confirmed.",
      );
    }

    // ── 2. Capacity check ─────────────────────────────────────────────────
    const vmConfig = this.toProviderConfig(order.vm_configuration);
    const capacity = await this.vmProvider.checkCapacity(vmConfig);
    if (!capacity.available) {
      throw new BadRequestException(
        `Insufficient capacity: ${capacity.reason ?? "no capacity available"}`,
      );
    }

    // ── 3. Create (idempotent) ────────────────────────────────────────────
    const job = await this.repo.createJob(order.id, order.customer_id, vmConfig);
    await this.db.query(`UPDATE orders SET status = CASE WHEN status = 'payment_verified' THEN 'provisioning' ELSE status END, updated_at = NOW() WHERE id = $1`, [order.id]);

    this.logger.log(
      `Provisioning job ${job.id} created for order ${dto.orderId} (status: ${job.status})`,
    );
    return job;
  }

  // ── Status / progress ────────────────────────────────────────────────────

  async getJobByOrder(user: AuthenticatedPrincipal, orderId: string) {
    await this.assertProviderOrderAccess(user, orderId);
    const job = await this.repo.findByOrderId(orderId);
    if (!job) throw new NotFoundException(`No provisioning job found for order ${orderId}`);
    const attempts = await this.repo.listAttempts(job.id);
    return { job, attempts };
  }

  async getJobById(user: AuthenticatedPrincipal, jobId: string) {
    const job = await this.repo.findById(jobId);
    if (!job) throw new NotFoundException(`Provisioning job ${jobId} not found`);
    await this.assertProviderOrderAccess(user, job.order_id);
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

    if (!(await this.isPaymentVerified(job.order_id))) {
      await this.repo.updateStatus(jobId, "CANCELLED", { last_error: "Authoritative payment gate failed before provider allocation", completed_at: new Date() });
      this.logger.warn(`Job ${jobId} cancelled because the order is no longer payment-verified`);
      return;
    }

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
   * This check is database-backed and repeated immediately before provider allocation:
   *   SELECT EXISTS(
   *     SELECT 1 FROM payment_records
   *     WHERE order_id = $orderId AND status = 'VERIFIED'
   *   )
   *
   */
  private async isPaymentVerified(orderId: string): Promise<boolean> {
    const result = await this.db.query<{ eligible: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM orders o
         JOIN invoices i ON i.order_id = o.id AND i.invoice_type = 'initial_order'
         JOIN payment_records p ON p.invoice_id = i.id AND p.order_id = o.id AND p.status = 'verified'
         JOIN capacity_reservations r ON r.order_id = o.id AND r.status = 'committed'
         WHERE o.id = $1
           AND o.status IN ('payment_verified','provisioning','provisioning_failed','active','suspended','completed')
           AND o.payment_verified_at IS NOT NULL
           AND o.provisioning_eligible_at IS NOT NULL
           AND i.status = 'paid'
           AND i.amount_paid = i.total
           AND p.amount = i.total
           AND p.currency = i.currency
       ) AS eligible`,
      [orderId],
    );
    return result.rows[0]?.eligible === true;
  }

  private toProviderConfig(config: Record<string, unknown>) {
    const vmConfig = {
      cpuCores: Number(config.cpuCores ?? config.cpu_cores),
      ramGb: Number(config.ramGb ?? config.ram_gb),
      storageGb: Number(config.storageGb ?? config.storage_gb),
      os: String(config.operatingSystem ?? config.operating_system ?? ""),
    };
    if (![vmConfig.cpuCores, vmConfig.ramGb, vmConfig.storageGb].every((value) => Number.isInteger(value) && value > 0) || !vmConfig.os) throw new BadRequestException("Persisted order VM configuration is invalid");
    return vmConfig;
  }

  private async assertProviderOrderAccess(user: AuthenticatedPrincipal, orderId: string): Promise<void> {
    const result = await this.db.query<{ organization_id: string }>(`SELECT organization_id FROM orders WHERE id = $1`, [orderId]);
    if (!result.rows[0]) throw new NotFoundException("Order not found");
    await this.authorization.assertOrganizationMember(user.userId, result.rows[0].organization_id);
  }
}
