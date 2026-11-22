import { BadRequestException, ConflictException } from "@nestjs/common";
import type { PricingRuleRow, PolicyRow } from "../pricing/repositories/pricing.repository.js";
import { applyPercent, divideHalfUp, formatMoney, parseMoney } from "../pricing/services/money.js";

export type NegotiationOutcome = "presented" | "countered" | "pending_provider_review" | "rejected";

export interface NegotiationRequest {
  requestedDiscountPercent?: string;
  requestedPrice?: string;
}

export interface NegotiationDecision {
  outcome: NegotiationOutcome;
  basePrice: string;
  requestedDiscountPercent: string;
  requestedPrice: string;
  discountPercent: string;
  discountAmount: string;
  finalPrice: string;
  currency: string;
  minimumPrice: string;
  maximumDiscountPercent: string;
  requiresApproval: boolean;
  reason: string;
  counteroffer: boolean;
}

const HUNDRED = 100n;
const PERCENT_SCALE = 10_000n;

function parsePercent(value: string): bigint {
  const scaled = parseMoney(value);
  if (scaled < 0n || scaled > 100n * PERCENT_SCALE || scaled % HUNDRED !== 0n) {
    throw new BadRequestException("Discount percentage must be between 0 and 100 with at most two decimal places");
  }
  return scaled;
}

function percentFromDiscount(base: bigint, discount: bigint): bigint {
  if (base === 0n) return 0n;
  // Returned value is a percentage scaled by 10,000, rounded to two decimals.
  const raw = divideHalfUp(discount * 100n * PERCENT_SCALE, base);
  return divideHalfUp(raw, HUNDRED) * HUNDRED;
}

function maxPercentAtFloor(base: bigint, floor: bigint): bigint {
  if (floor > base) throw new ConflictException("The provider price floor exceeds the authoritative base price");
  let percent = percentFromDiscount(base, base - floor);
  while (percent > 0n && base - applyPercent(base, percent / HUNDRED) < floor) percent -= HUNDRED;
  return percent;
}

function minMoney(values: Array<bigint>): bigint {
  return values.reduce((lowest, value) => value < lowest ? value : lowest, values[0] ?? 0n);
}

export function evaluateNegotiation(
  basePriceText: string,
  currency: string,
  policy: PolicyRow,
  rules: PricingRuleRow[],
  request: NegotiationRequest,
): NegotiationDecision {
  const basePrice = parseMoney(basePriceText);
  const ruleMinimum = rules.reduce((highest, rule) => {
    const value = rule.minimum_price ? parseMoney(rule.minimum_price) : 0n;
    return value > highest ? value : highest;
  }, 0n);
  const policyMinimum = parseMoney(policy.minimum_price);
  const minimumPrice = policyMinimum > ruleMinimum ? policyMinimum : ruleMinimum;
  const ruleCeilings = rules
    .filter((rule) => rule.maximum_discount_percent !== null)
    .map((rule) => parsePercent(rule.maximum_discount_percent!));
  const policyCeiling = parsePercent(policy.maximum_discount_percent);
  const maximumDiscount = minMoney([policyCeiling, ...ruleCeilings]);
  const floorCeiling = maxPercentAtFloor(basePrice, minimumPrice);
  const allowedDiscount = maximumDiscount < floorCeiling ? maximumDiscount : floorCeiling;

  const requestedPercent = request.requestedDiscountPercent
    ? parsePercent(request.requestedDiscountPercent)
    : undefined;
  const requestedPrice = request.requestedPrice !== undefined ? parseMoney(request.requestedPrice) : undefined;
  if (requestedPrice !== undefined && requestedPrice > basePrice) {
    throw new BadRequestException("Requested price cannot exceed the authoritative base price");
  }
  if (requestedPrice !== undefined && requestedPrice < minimumPrice) {
    // A price below the hard floor is safely answered with the deterministic floor counteroffer.
  }

  const impliedPercent = requestedPrice === undefined
    ? undefined
    : percentFromDiscount(basePrice, basePrice - requestedPrice);
  if (requestedPercent !== undefined && impliedPercent !== undefined) {
    const impliedAmount = applyPercent(basePrice, impliedPercent / HUNDRED);
    const requestedAmount = basePrice - requestedPrice!;
    if (impliedAmount !== requestedAmount) {
      throw new BadRequestException("Requested price and discount percentage do not describe the same terms");
    }
  }

  const requested = requestedPercent ?? impliedPercent ?? 0n;
  if (requested > 100n * PERCENT_SCALE) {
    throw new BadRequestException("Discount percentage cannot exceed 100");
  }

  const needsCounter = requested > allowedDiscount || (requestedPrice !== undefined && requestedPrice < minimumPrice);
  const finalPercent = needsCounter ? allowedDiscount : requested;
  const discountAmount = applyPercent(basePrice, finalPercent / HUNDRED);
  const finalPrice = basePrice - discountAmount;
  if (finalPrice < minimumPrice) throw new ConflictException("The calculated offer would violate the provider price floor");

  const requiresApproval = finalPrice < parseMoney(policy.approval_threshold);
  const outcome: NegotiationOutcome = requiresApproval ? "pending_provider_review" : needsCounter ? "countered" : "presented";
  const requestedPriceOutput = requestedPrice ?? basePrice - applyPercent(basePrice, requested / HUNDRED);
  const reason = needsCounter
    ? "Requested terms exceed the deterministic automatic negotiation boundary; the highest permitted terms are returned."
    : requiresApproval
      ? "The resulting price is above the hard floor but below the provider's automatic approval threshold."
      : "Requested terms satisfy the active pricing rules and negotiation policy.";

  return {
    outcome,
    basePrice: formatMoney(basePrice),
    requestedDiscountPercent: formatMoney(requested),
    requestedPrice: formatMoney(requestedPriceOutput),
    discountPercent: formatMoney(finalPercent),
    discountAmount: formatMoney(discountAmount),
    finalPrice: formatMoney(finalPrice),
    currency,
    minimumPrice: formatMoney(minimumPrice),
    maximumDiscountPercent: formatMoney(allowedDiscount),
    requiresApproval,
    reason,
    counteroffer: needsCounter,
  };
}
