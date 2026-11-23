import { ConflictException } from "@nestjs/common";

export type OfferStatus = "draft" | "presented" | "countered" | "pending_provider_review" | "approved" | "accepted" | "declined" | "expired" | "rejected" | "cancelled";

const transitions: Record<OfferStatus, readonly OfferStatus[]> = {
  draft: ["presented", "pending_provider_review", "cancelled"],
  presented: ["countered", "declined", "accepted", "expired", "cancelled"],
  countered: [],
  pending_provider_review: ["approved", "rejected", "expired", "cancelled", "countered"],
  approved: ["countered", "declined", "accepted", "expired", "cancelled"],
  accepted: [],
  declined: [],
  expired: [],
  rejected: [],
  cancelled: [],
};

export function assertOfferTransition(from: string, to: OfferStatus): void {
  if (!transitions[from as OfferStatus]?.includes(to)) {
    throw new ConflictException(`Offer cannot transition from ${from} to ${to}`);
  }
}

export function isCustomerActionable(status: string): boolean {
  return status === "presented" || status === "approved";
}

export function isExpirable(status: string): boolean {
  return status === "presented" || status === "pending_provider_review" || status === "approved";
}

export function isOfferExpired(expiresAt: Date | string | null, now = new Date()): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() <= now.getTime();
}
