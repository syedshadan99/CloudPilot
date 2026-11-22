import {
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { APP_CONFIG, type AppConfig } from "../../config/index.js";
import { IdentityService } from "../../modules/identity/services/identity.service.js";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";
import type { AuthenticatedRequest } from "../auth/authenticated-principal.js";
import { readCookie } from "../http/cookies.js";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly identity: IdentityService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // CORS preflight must complete before authentication is evaluated.
    if (request.method === "OPTIONS") return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const rawToken = readCookie(request.headers.cookie, this.config.session.cookieName);
    if (!rawToken) throw new UnauthorizedException("Authentication required");

    const principal = await this.identity.validateSession(rawToken);
    if (!principal) throw new UnauthorizedException("Authentication required");

    request.user = principal;
    return true;
  }
}
