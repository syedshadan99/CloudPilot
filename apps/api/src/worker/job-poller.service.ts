import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { ProvisioningService } from "../modules/provisioning/provisioning.service.js";

/**
 * Polls the provisioning_jobs table for QUEUED jobs on a fixed interval.
 *
 * Design: simple PostgreSQL-backed polling — no Redis, no BullMQ, no external
 * queue. The UNIQUE(order_id) constraint on provisioning_jobs plus the status
 * check inside ProvisioningService.processNextBatch() guarantee idempotency
 * and prevent duplicate processing when multiple worker instances run.
 */
@Injectable()
export class JobPollerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(JobPollerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  /** Poll interval in ms. Override via WORKER_POLL_MS env var. */
  private readonly intervalMs: number;

  constructor(private readonly provisioning: ProvisioningService) {
    this.intervalMs = parseInt(process.env["WORKER_POLL_MS"] ?? "5000", 10);
  }

  onApplicationBootstrap(): void {
    this.logger.log(`Job poller starting — interval ${this.intervalMs}ms`);
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    // Run immediately on startup to pick up any queued jobs from before restart
    void this.tick();
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log("Job poller stopped");
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return; // skip if previous tick is still running
    this.running = true;
    try {
      await this.provisioning.processNextBatch();
    } catch (err) {
      this.logger.error(
        `Job poller tick error: ${(err as Error).message ?? String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
