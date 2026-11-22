import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

interface Bucket { count: number; resetAt: number; }

/**
 * Small bounded in-process limiter for this single-instance demo deployment.
 * It is intentionally not described as restart-safe or multi-instance-safe;
 * a shared limiter can replace this provider when the deployment decision is
 * made.
 */
@Injectable()
export class RateLimiterService {
  private readonly buckets = new Map<string, Bucket>();

  consume(key: string, limit: number, windowMs: number): void {
    const now = Date.now();
    const existing = this.buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    this.prune(now);
    if (bucket.count > limit) {
      throw new HttpException("Too many attempts. Please try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private prune(now: number): void {
    if (this.buckets.size < 1000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
