/**
 * CP-13 unit tests — VM lifecycle state machine, ownership, and usage generator.
 * Uses Node.js built-in test runner (node --test). No Jest / Vitest.
 *
 * Run from repo root:
 *   node --test apps/api/test/unit/vm-lifecycle.test.js
 *
 * The state-machine module is TypeScript compiled to dist/. Run after:
 *   npm run build --workspace=apps/api
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveTransition, isTransitionAllowed } from "../../dist/modules/vms/vm-state-machine.js";
import { generateUsageMetrics, currentHourStart } from "../../dist/modules/usage/usage-generator.js";

// ── State machine — valid transitions ────────────────────────────────────────

describe("VM state machine — valid transitions", () => {
  it("RUNNING → STOPPING via STOP", () => {
    assert.equal(resolveTransition("RUNNING", "STOP"), "STOPPING");
  });

  it("RUNNING → TERMINATED via TERMINATE", () => {
    assert.equal(resolveTransition("RUNNING", "TERMINATE"), "TERMINATED");
  });

  it("STOPPED → RUNNING via START", () => {
    assert.equal(resolveTransition("STOPPED", "START"), "RUNNING");
  });

  it("STOPPED → RUNNING via RESTART", () => {
    assert.equal(resolveTransition("STOPPED", "RESTART"), "RUNNING");
  });

  it("STOPPED → TERMINATED via TERMINATE", () => {
    assert.equal(resolveTransition("STOPPED", "TERMINATE"), "TERMINATED");
  });
});

// ── State machine — invalid transitions ──────────────────────────────────────

describe("VM state machine — invalid transitions", () => {
  it("PROVISIONING does not allow STOP", () => {
    assert.equal(resolveTransition("PROVISIONING", "STOP"), null);
  });

  it("PROVISIONING does not allow START", () => {
    assert.equal(resolveTransition("PROVISIONING", "START"), null);
  });

  it("PROVISIONING does not allow TERMINATE", () => {
    assert.equal(resolveTransition("PROVISIONING", "TERMINATE"), null);
  });

  it("TERMINATED does not allow START", () => {
    assert.equal(resolveTransition("TERMINATED", "START"), null);
  });

  it("TERMINATED does not allow STOP", () => {
    assert.equal(resolveTransition("TERMINATED", "STOP"), null);
  });

  it("RUNNING does not allow START", () => {
    assert.equal(resolveTransition("RUNNING", "START"), null);
  });

  it("RUNNING does not allow RESTART", () => {
    assert.equal(resolveTransition("RUNNING", "RESTART"), null);
  });

  it("STOPPING does not allow any customer action", () => {
    for (const a of ["START", "STOP", "RESTART", "TERMINATE"]) {
      assert.equal(resolveTransition("STOPPING", a), null, `STOPPING should block ${a}`);
    }
  });
});

// ── isTransitionAllowed helper ────────────────────────────────────────────────

describe("isTransitionAllowed", () => {
  it("returns true for STOPPED → START", () => {
    assert.equal(isTransitionAllowed("STOPPED", "START"), true);
  });

  it("returns false for PROVISIONING → STOP", () => {
    assert.equal(isTransitionAllowed("PROVISIONING", "STOP"), false);
  });
});

// ── Usage generator — reproducibility ─────────────────────────────────────────

describe("Usage generator — deterministic output", () => {
  const vmId = "test-vm-uuid-1234";
  const periodStart = new Date("2025-01-15T10:00:00.000Z");

  it("produces the same metrics for the same inputs", () => {
    const a = generateUsageMetrics(vmId, periodStart);
    const b = generateUsageMetrics(vmId, periodStart);
    assert.deepEqual(a, b);
  });

  it("produces different metrics for different vmId", () => {
    const a = generateUsageMetrics(vmId, periodStart);
    const b = generateUsageMetrics("other-vm-uuid-9999", periodStart);
    // At least one field must differ
    const differs = Object.keys(a).some(
      (k) => a[k] !== b[k],
    );
    assert.ok(differs, "metrics should differ for different vmId");
  });

  it("produces different metrics for different periodStart", () => {
    const a = generateUsageMetrics(vmId, periodStart);
    const b = generateUsageMetrics(vmId, new Date("2025-01-15T11:00:00.000Z"));
    const differs = Object.keys(a).some((k) => a[k] !== b[k]);
    assert.ok(differs, "metrics should differ for different period");
  });

  it("cpu_percent is in range [10, 85]", () => {
    const m = generateUsageMetrics(vmId, periodStart);
    assert.ok(m.cpu_percent >= 10 && m.cpu_percent <= 85, `cpu_percent out of range: ${m.cpu_percent}`);
  });

  it("ram_percent is in range [20, 75]", () => {
    const m = generateUsageMetrics(vmId, periodStart);
    assert.ok(m.ram_percent >= 20 && m.ram_percent <= 75, `ram_percent out of range: ${m.ram_percent}`);
  });

  it("disk_read_mb is in range [1, 500]", () => {
    const m = generateUsageMetrics(vmId, periodStart);
    assert.ok(m.disk_read_mb >= 1 && m.disk_read_mb <= 500);
  });

  it("net_out_mb is in range [1, 100]", () => {
    const m = generateUsageMetrics(vmId, periodStart);
    assert.ok(m.net_out_mb >= 1 && m.net_out_mb <= 100);
  });
});

// ── currentHourStart ──────────────────────────────────────────────────────────

describe("currentHourStart", () => {
  it("returns a Date with minutes, seconds, ms all 0", () => {
    const h = currentHourStart();
    assert.equal(h.getUTCMinutes(), 0);
    assert.equal(h.getUTCSeconds(), 0);
    assert.equal(h.getUTCMilliseconds(), 0);
  });
});
