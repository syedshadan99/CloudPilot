import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "../auth/authenticated-principal.js";

export const REQUIRED_ROLES_KEY = "cloudpilot:required_roles";
export const Roles = (...roles: UserRole[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);
