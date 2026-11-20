import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { type Observable, tap } from "rxjs";

/**
 * Logs every incoming HTTP request and its response status / duration.
 *
 * Example output:
 *   [RequestLogger] GET /health → 200 (3ms)
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { method, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = ctx.getResponse<Response>();
          const duration = Date.now() - start;
          this.logger.log(`${method} ${url} → ${response.statusCode} (${duration}ms)`);
        },
        error: (err: unknown) => {
          const duration = Date.now() - start;
          const status = this.extractStatus(err);
          this.logger.warn(`${method} ${url} → ${status} (${duration}ms)`);
        },
      }),
    );
  }

  private extractStatus(err: unknown): number {
    if (
      typeof err === "object" &&
      err !== null &&
      "getStatus" in err &&
      typeof (err as { getStatus: unknown }).getStatus === "function"
    ) {
      return (err as { getStatus(): number }).getStatus();
    }
    return 500;
  }
}
