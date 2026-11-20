import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Consistent JSON error envelope for every unhandled or HTTP exception.
 *
 * Shape:
 * ```json
 * {
 *   "statusCode": 400,
 *   "error": "Bad Request",
 *   "message": "Validation failed",
 *   "details": [ ... ],
 *   "path": "/api/v1/...",
 *   "timestamp": "2026-11-20T17:00:00.000Z"
 * }
 * ```
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = "Internal Server Error";
    let message: string | string[] = "An unexpected error occurred";
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const obj = body as Record<string, unknown>;
        message = (obj["message"] as string | string[]) ?? exception.message;
        error = (obj["error"] as string) ?? error;
        // class-validator returns message arrays for DTO failures
        if (Array.isArray(message)) {
          details = message;
          message = "Validation failed";
        }
      }

      error = this.statusToPhrase(status) ?? error;
    } else {
      // Unexpected / non-HTTP exception — log full stack, return generic 500
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const payload = {
      statusCode: status,
      error,
      message,
      ...(details !== undefined ? { details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(payload);
  }

  private statusToPhrase(status: number): string | undefined {
    const phrases: Record<number, string> = {
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      405: "Method Not Allowed",
      409: "Conflict",
      422: "Unprocessable Entity",
      429: "Too Many Requests",
      500: "Internal Server Error",
      502: "Bad Gateway",
      503: "Service Unavailable",
    };
    return phrases[status];
  }
}
