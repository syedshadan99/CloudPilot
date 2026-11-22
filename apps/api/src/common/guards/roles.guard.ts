import {
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_ROLES_KEY } from "../decorators/roles.decorator.js";
import type { AuthenticatedRequest, UserRole } from "../auth/authenticated-principal.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!principal || !required.includes(principal.role)) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return true;
  }
}
