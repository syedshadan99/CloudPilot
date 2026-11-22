import type { Request } from "express";

export const USER_ROLES = ["customer", "provider_admin", "provider_staff"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: "active";
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}
