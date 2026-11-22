import assert from "node:assert/strict";
import test from "node:test";
import { formatMoney, parseMoney, periodCount } from "../../dist/modules/pricing/services/money.js";
import { PolicyService } from "../../dist/modules/pricing/services/policy.service.js";

test("exact money arithmetic keeps seeded hourly and daily totals lossless", () => {
  assert.equal(formatMoney(parseMoney("0.12") * BigInt(periodCount("hourly", 30))), "86.4000");
  assert.equal(formatMoney(parseMoney("2.88") * BigInt(periodCount("daily", 30))), "86.4000");
  assert.equal(formatMoney(parseMoney("48.0000") * BigInt(periodCount("monthly", 30))), "48.0000");
});

test("monthly duration requires whole fixed 30-day periods", () => {
  assert.equal(periodCount("monthly", 60), 2);
  assert.throws(() => periodCount("monthly", 31), /MONTHLY_DURATION_MUST_BE_MULTIPLE_OF_30_DAYS/);
});

test("money parser rejects floating-point-shaped or over-precision authority values", () => {
  assert.throws(() => parseMoney("0.12345"), /INVALID_DECIMAL/);
  assert.throws(() => parseMoney("1e3"), /INVALID_DECIMAL/);
  assert.equal(formatMoney(parseMoney("40")), "40.0000");
});

test("policy evaluation enforces the most restrictive discount and price floor", async () => {
  const repository = {
    effectivePolicy: async () => ({
      id: "policy-1", organization_id: "org-1", name: "Demo", maximum_discount_percent: "10.00",
      minimum_price: "40.0000", approval_threshold: "42.0000", maximum_attempts: 3,
      effective_from: new Date("2026-01-01T00:00:00Z"), effective_to: null, active: true,
      created_by: "provider-1", created_at: new Date("2026-01-01T00:00:00Z"),
    }),
  };
  const authorization = { assertOrganizationMember: async () => undefined };
  const service = new PolicyService(repository, authorization);
  const result = await service.evaluate({ userId: "provider-1", role: "provider_admin" }, {
    organizationId: "org-1", basePrice: "48.0000", proposedPrice: "39.0000", discountPercent: "18.75", currency: "USD",
    pricingRuleMinimumPrice: "44.0000", pricingRuleMaximumDiscountPercent: "8.00",
  });
  assert.equal(result.maximumDiscountPercent, "8.0000");
  assert.equal(result.minimumPrice, "44.0000");
  assert.equal(result.discountAllowed, false);
  assert.equal(result.priceFloorSatisfied, false);
  assert.equal(result.allowed, false);
});
