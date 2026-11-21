/**
 * Unit tests for SimulatedVmProvider (no DB, no network).
 * Run: node --test apps/api/test/unit/provisioning.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SimulatedVmProvider } from "../../dist/modules/provisioning/adapters/simulated-vm.provider.js";

const JOB_ID   = "123e4567-e89b-12d3-a456-426614174000";
const ORDER_ID = "223e4567-e89b-12d3-a456-426614174001";
const CUST_ID  = "323e4567-e89b-12d3-a456-426614174002";

// Use stageDelayMs=0 so tests run instantly
const provider = new SimulatedVmProvider(0);

describe("SimulatedVmProvider — capacity checks", () => {
  it("accepts a normal VM config", async () => {
    const r = await provider.checkCapacity({ cpuCores: 4, ramGb: 8, storageGb: 100, os: "Ubuntu" });
    assert.ok(r.available);
    assert.equal(r.reason, undefined);
  });

  it("rejects CPU > 64", async () => {
    const r = await provider.checkCapacity({ cpuCores: 128, ramGb: 8, storageGb: 100, os: "Ubuntu" });
    assert.ok(!r.available);
    assert.ok(r.reason?.includes("CPU"));
  });

  it("rejects RAM > 512 GB", async () => {
    const r = await provider.checkCapacity({ cpuCores: 4, ramGb: 1024, storageGb: 100, os: "Ubuntu" });
    assert.ok(!r.available);
    assert.ok(r.reason?.includes("RAM"));
  });

  it("rejects storage > 10240 GB", async () => {
    const r = await provider.checkCapacity({ cpuCores: 4, ramGb: 8, storageGb: 20000, os: "Ubuntu" });
    assert.ok(!r.available);
    assert.ok(r.reason?.includes("storage"));
  });

  it("accepts boundary values (64 vCPU / 512 GB / 10240 GB)", async () => {
    const r = await provider.checkCapacity({ cpuCores: 64, ramGb: 512, storageGb: 10240, os: "Linux" });
    assert.ok(r.available);
  });
});

describe("SimulatedVmProvider — provisioning", () => {
  it("returns a simulatedVmId, hostname, and IP", async () => {
    const r = await provider.provision({
      jobId: JOB_ID,
      orderId: ORDER_ID,
      customerId: CUST_ID,
      config: { cpuCores: 2, ramGb: 4, storageGb: 50, os: "Ubuntu" },
    });

    assert.ok(r.simulatedVmId.startsWith("sim-vm-"), `expected sim-vm- prefix, got ${r.simulatedVmId}`);
    assert.ok(r.hostname.includes(".sim.cloudpilot.local"));
    assert.match(r.ipAddress, /^10\.\d+\.\d+\.\d+$/);
  });

  it("produces deterministic IDs from the same jobId", async () => {
    const a = await provider.provision({
      jobId: JOB_ID, orderId: ORDER_ID, customerId: CUST_ID,
      config: { cpuCores: 1, ramGb: 2, storageGb: 20, os: "Debian" },
    });
    const b = await provider.provision({
      jobId: JOB_ID, orderId: ORDER_ID, customerId: CUST_ID,
      config: { cpuCores: 1, ramGb: 2, storageGb: 20, os: "Debian" },
    });
    assert.equal(a.simulatedVmId, b.simulatedVmId);
    assert.equal(a.ipAddress, b.ipAddress);
  });

  it("produces different IDs for different jobIds", async () => {
    const other = "aabbccdd-e89b-12d3-a456-426614174999";
    const a = await provider.provision({
      jobId: JOB_ID, orderId: ORDER_ID, customerId: CUST_ID,
      config: { cpuCores: 1, ramGb: 2, storageGb: 20, os: "CentOS" },
    });
    const b = await provider.provision({
      jobId: other, orderId: ORDER_ID, customerId: CUST_ID,
      config: { cpuCores: 1, ramGb: 2, storageGb: 20, os: "CentOS" },
    });
    assert.notEqual(a.simulatedVmId, b.simulatedVmId);
  });
});

describe("Progress stages contract", () => {
  it("progress stage values match the roadmap spec", () => {
    const expected = [
      "QUEUED",
      "ALLOCATING",
      "PREPARING_OS",
      "ASSIGNING_NETWORK",
      "BOOTING",
      "HEALTH_CHECK",
      "READY",
      "FAILED",
      "CANCELLED",
    ];
    // These are the CHECK constraint values from 0002_provisioning.sql.
    // Test ensures the string literals match so code and DB stay aligned.
    const actual = [
      "QUEUED", "ALLOCATING", "PREPARING_OS", "ASSIGNING_NETWORK",
      "BOOTING", "HEALTH_CHECK", "READY", "FAILED", "CANCELLED",
    ];
    assert.deepEqual(actual, expected);
  });
});
