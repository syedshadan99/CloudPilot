import assert from "node:assert/strict";
import test from "node:test";
import { prepaidCoverageEnd, rateProvisionedCompute } from "../../dist/modules/billing/rating-engine.js";

test("CP-07 excludes runtime wholly inside the CP-06 prepaid coverage period", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const result = rateProvisionedCompute({ periodStart: start, periodEnd: new Date("2026-01-01T01:00:00Z"), coverageEnd: new Date("2026-01-02T00:00:00Z"), runtimeSeconds: 3600n, vcpuCount: 2n, ratePerPeriod: "0.0800", billingCycle: "hourly" });
  assert.equal(result, null);
});

test("CP-07 prorates only the uncovered boundary using six-decimal quantity arithmetic", () => {
  const result = rateProvisionedCompute({ periodStart: new Date("2026-01-02T00:00:00Z"), periodEnd: new Date("2026-01-02T01:00:00Z"), coverageEnd: new Date("2026-01-02T00:30:00Z"), runtimeSeconds: 3600n, vcpuCount: 2n, ratePerPeriod: "0.0800", billingCycle: "hourly" });
  assert.deepEqual(result && { quantity: result.quantity, unitPrice: result.unitPrice, amount: result.amount }, { quantity: "1.000000", unitPrice: "0.0800", amount: "0.0800" });
});

test("CP-07 uses fixed 30-day monthly coverage", () => {
  assert.equal(prepaidCoverageEnd(new Date("2026-01-01T00:00:00Z"), 30).toISOString(), "2026-01-31T00:00:00.000Z");
});
