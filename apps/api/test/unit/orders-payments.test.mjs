import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSimulatedPayment } from "../../dist/modules/payments/payment-rules.js";
import { assertOfferTransition } from "../../dist/modules/offers/offer-state-machine.js";

test("CP-06 offer acceptance permits presented and approved offers only through explicit transition", () => {
  assert.doesNotThrow(() => assertOfferTransition("presented", "accepted"));
  assert.doesNotThrow(() => assertOfferTransition("approved", "accepted"));
  assert.throws(() => assertOfferTransition("declined", "accepted"));
});

test("simulated payment verifies only an exact full amount in the invoice currency", () => {
  assert.deepEqual(evaluateSimulatedPayment("44.0000", "44.0000", "USD", "USD"), { status: "verified", failureReason: null });
  assert.equal(evaluateSimulatedPayment("43.9999", "44.0000", "USD", "USD").status, "failed");
  assert.equal(evaluateSimulatedPayment("44.0001", "44.0000", "USD", "USD").status, "failed");
  assert.equal(evaluateSimulatedPayment("44.0000", "44.0000", "EUR", "USD").status, "failed");
});

test("simulated payment arithmetic remains exact at four decimal places", () => {
  assert.deepEqual(evaluateSimulatedPayment("0.3000", "0.3000", "USD", "USD"), { status: "verified", failureReason: null });
});
