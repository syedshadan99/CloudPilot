import assert from "node:assert/strict";
import test from "node:test";
import { evaluateNegotiation } from "../../dist/modules/negotiation/negotiation-engine.js";
import { isOfferExpired, isCustomerActionable, assertOfferTransition } from "../../dist/modules/offers/offer-state-machine.js";
import { ConflictException, BadRequestException } from "@nestjs/common";

const policy = (overrides = {}) => ({
  id: "policy-1", organization_id: "org-1", name: "Demo", maximum_discount_percent: "10.00",
  minimum_price: "40.0000", approval_threshold: "42.0000", maximum_attempts: 3,
  effective_from: new Date("2026-01-01T00:00:00Z"), effective_to: null, active: true,
  created_by: "provider-1", created_at: new Date("2026-01-01T00:00:00Z"), ...overrides,
});

const rule = (overrides = {}) => ({
  id: "rule-1", pricing_version_id: "version-1", vm_template_id: "template-1", rule_type: "template_base",
  hourly_rate: "1.0000", daily_rate: "24.0000", monthly_rate: "48.0000", unit_price: null,
  minimum_price: "40.0000", maximum_discount_percent: null, metadata: {}, created_at: new Date(), ...overrides,
});

test("zero discount preserves exact base price", () => {
  const result = evaluateNegotiation("48.0000", "USD", policy(), [rule()], {});
  assert.equal(result.discountPercent, "0.0000");
  assert.equal(result.discountAmount, "0.0000");
  assert.equal(result.finalPrice, "48.0000");
  assert.equal(result.outcome, "presented");
});

test("valid and maximum discounts use two-decimal percentage and four-decimal money arithmetic", () => {
  const result = evaluateNegotiation("48.0000", "USD", policy(), [rule()], { requestedDiscountPercent: "10.00" });
  assert.equal(result.discountPercent, "10.0000");
  assert.equal(result.discountAmount, "4.8000");
  assert.equal(result.finalPrice, "43.2000");
});

test("the stricter rule ceiling wins over the provider policy", () => {
  const result = evaluateNegotiation("48.0000", "USD", policy(), [rule({ maximum_discount_percent: "8.00" })], { requestedDiscountPercent: "10.00" });
  assert.equal(result.maximumDiscountPercent, "8.0000");
  assert.equal(result.discountPercent, "8.0000");
  assert.equal(result.outcome, "countered");
});

test("price floor and approval threshold are enforced deterministically", () => {
  const result = evaluateNegotiation("48.0000", "USD", policy({ approval_threshold: "45.0000" }), [rule()], { requestedDiscountPercent: "10.00" });
  assert.equal(result.finalPrice, "43.2000");
  assert.equal(result.outcome, "pending_provider_review");

  const floorCounter = evaluateNegotiation("48.0000", "USD", policy({ maximum_discount_percent: "50.00" }), [rule({ minimum_price: "46.0000" })], { requestedPrice: "20.0000" });
  assert.equal(floorCounter.finalPrice, "46.0032");
  assert.equal(floorCounter.discountPercent, "4.1600");
});

test("conflicting price and percentage inputs are rejected", () => {
  assert.throws(
    () => evaluateNegotiation("48.0000", "USD", policy(), [rule()], { requestedDiscountPercent: "10.00", requestedPrice: "44.0000" }),
    (error) => error instanceof BadRequestException,
  );
});

test("hard floor above the base price is rejected and outcomes are stable", () => {
  assert.throws(
    () => evaluateNegotiation("48.0000", "USD", policy({ minimum_price: "50.0000" }), [rule()], {}),
    (error) => error instanceof ConflictException,
  );
  const input = { requestedDiscountPercent: "8.00" };
  assert.deepEqual(evaluateNegotiation("48.0000", "USD", policy(), [rule()], input), evaluateNegotiation("48.0000", "USD", policy(), [rule()], input));
});

test("state machine and hard expiry helpers protect terminal offers", () => {
  assert.equal(isCustomerActionable("presented"), true);
  assert.equal(isCustomerActionable("pending_provider_review"), false);
  assert.equal(isOfferExpired(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z")), true);
  assert.doesNotThrow(() => assertOfferTransition("presented", "declined"));
  assert.throws(() => assertOfferTransition("declined", "approved"), /cannot transition/);
});
