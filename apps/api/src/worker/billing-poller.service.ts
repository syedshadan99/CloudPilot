import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { BillingService } from "../modules/billing/billing.service.js";

@Injectable()
export class BillingPollerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BillingPollerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly intervalMs = Number(process.env["BILLING_POLL_MS"] ?? 60000);

  constructor(private readonly billing: BillingService) {}

  onApplicationBootstrap(): void { this.timer = setInterval(() => void this.tick(), this.intervalMs); void this.tick(); }
  onApplicationShutdown(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const end = new Date(); end.setUTCMinutes(0, 0, 0);
      const start = new Date(end.getTime() - 3_600_000);
      const result = await this.billing.issueRecurringInvoices(start, end);
      if (result.invoices || result.charges) this.logger.log(`Billing tick closed ${result.invoices} invoice(s) and ${result.charges} charge(s)`);
    } catch (error) { this.logger.error(`Billing tick failed: ${(error as Error).message ?? String(error)}`); }
    finally { this.running = false; }
  }
}
