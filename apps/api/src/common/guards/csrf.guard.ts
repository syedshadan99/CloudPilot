import {
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { timingSafeEqual, createHmac } from "node:crypto";
import type { Request } from "express";
import { APP_CONFIG, type AppConfig } from "../../config/index.js";
import { readCookie } from "../http/cookies.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const sessionToken = readCookie(request.headers.cookie, this.config.session.cookieName);
    // Registration, login, recovery and verification do not authenticate with
    // the session cookie, so they do not need a session-bound CSRF token.
    if (!sessionToken) return true;

    this.assertAllowedBrowserOrigin(request);

    const supplied = request.headers["x-csrf-token"];
    const headerToken = Array.isArray(supplied) ? supplied[0] : supplied;
    const cookieToken = readCookie(request.headers.cookie, "cloudpilot_csrf");
    const expected = createHmac("sha256", this.config.csrfSecret)
      .update(sessionToken)
      .digest("base64url");

    if (!headerToken || !cookieToken || !this.equals(headerToken, cookieToken) || !this.equals(headerToken, expected)) {
      throw new ForbiddenException("CSRF validation failed");
    }
    return true;
  }

  private assertAllowedBrowserOrigin(request: Request): void {
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    const candidate = origin ?? (referer ? this.originFromReferer(referer) : undefined);
    const allowed = this.config.corsOrigin.split(",").map((value) => value.trim()).filter(Boolean);
    if (!candidate || !allowed.includes(candidate)) {
      throw new ForbiddenException("CSRF browser origin is not allowed");
    }
  }

  private originFromReferer(value: string): string | undefined {
    try {
      return new URL(value).origin;
    } catch {
      return undefined;
    }
  }

  private equals(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
