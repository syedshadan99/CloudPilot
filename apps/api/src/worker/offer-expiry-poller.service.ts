import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { OffersService } from "../modules/offers/offers.service.js";

@Injectable()
export class OfferExpiryPollerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OfferExpiryPollerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly intervalMs = Math.max(5_000, Number(process.env["OFFER_EXPIRY_POLL_MS"] ?? 60_000));

  constructor(private readonly offers: OffersService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    void this.tick();
    this.logger.log(`Offer expiry poller started — interval ${this.intervalMs}ms`);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const processed = await this.offers.processExpiryBatch(100);
      if (processed > 0) this.logger.log(`Expired ${processed} offer(s)`);
    } catch (error) {
      this.logger.warn(`Offer expiry tick failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
