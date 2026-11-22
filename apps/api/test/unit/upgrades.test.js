/**
 * CP-14 unit tests — Upgrades, downgrades, resize jobs, pricing, approvals, storage safety, and rollback.
 * Uses Node.js built-in test runner (node --test).
 *
 * Run from repo root:
 *   node --test apps/api/test/unit/upgrades.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateMonthlyPrice,
  calculatePriceDifference,
} from "../../dist/modules/upgrades/pricing-calculator.js";
import {
  validateStorageSafety,
  validateConfigurationChange,
} from "../../dist/modules/upgrades/upgrade-validator.js";
import { UpgradesService } from "../../dist/modules/upgrades/upgrades.service.js";
import { SimulatedVmProvider } from "../../dist/modules/provisioning/adapters/simulated-vm.provider.js";

// ── 1. Pricing Calculations & Rate Differences ──────────────────────────────

describe("Pricing calculations & rate differences", () => {
  it("calculates monthly price accurately from rate card ($5/cpu, $2/ram, $0.10/storage)", () => {
    // 2 vCPU * 5 = 10; 4 GB RAM * 2 = 8; 50 GB storage * 0.10 = 5 -> Total: 23
    const price = calculateMonthlyPrice({ cpuCores: 2, ramGb: 4, storageGb: 50 });
    assert.equal(price, 23.0);
  });

  it("calculates price difference for an upgrade (positive difference)", () => {
    const oldSpec = { cpuCores: 2, ramGb: 4, storageGb: 50 };   // $23.00
    const newSpec = { cpuCores: 4, ramGb: 8, storageGb: 100 };  // $46.00
    const diff = calculatePriceDifference(oldSpec, newSpec);
    assert.equal(diff, 23.0);
  });

  it("calculates price difference for a downgrade (negative difference)", () => {
    const oldSpec = { cpuCores: 4, ramGb: 8, storageGb: 100 };  // $46.00
    const newSpec = { cpuCores: 2, ramGb: 4, storageGb: 100 };  // $28.00
    const diff = calculatePriceDifference(oldSpec, newSpec);
    assert.equal(diff, -18.0);
  });

  it("calculates zero price difference if specs have equivalent costs", () => {
    const oldSpec = { cpuCores: 2, ramGb: 4, storageGb: 50 };
    const diff = calculatePriceDifference(oldSpec, oldSpec);
    assert.equal(diff, 0.0);
  });
});

// ── 2. Storage Safety Rules ─────────────────────────────────────────────────

describe("Storage safety rules (disk shrinking prohibited)", () => {
  it("rejects shrinking storage allocation below current allocation", () => {
    const oldSpec = { cpuCores: 2, ramGb: 4, storageGb: 100 };
    const newSpec = { cpuCores: 4, ramGb: 8, storageGb: 80 }; // shrunk storage!

    assert.throws(
      () => validateStorageSafety(oldSpec, newSpec),
      /Storage cannot be reduced below current allocation/,
    );
  });

  it("allows increasing storage allocation", () => {
    const oldSpec = { cpuCores: 2, ramGb: 4, storageGb: 100 };
    const newSpec = { cpuCores: 2, ramGb: 4, storageGb: 200 };
    assert.doesNotThrow(() => validateStorageSafety(oldSpec, newSpec));
  });

  it("allows keeping storage allocation unchanged", () => {
    const oldSpec = { cpuCores: 2, ramGb: 4, storageGb: 100 };
    const newSpec = { cpuCores: 4, ramGb: 8, storageGb: 100 };
    assert.doesNotThrow(() => validateStorageSafety(oldSpec, newSpec));
  });
});

// ── 3. Configuration Validation ─────────────────────────────────────────────

describe("Configuration validation", () => {
  const baseSpec = { cpuCores: 2, ramGb: 4, storageGb: 50 };

  it("rejects identical configurations", () => {
    assert.throws(
      () => validateConfigurationChange(baseSpec, { cpuCores: 2, ramGb: 4, storageGb: 50 }),
      /Requested configuration is identical to the current VM configuration/,
    );
  });

  it("rejects CPU cores outside bounds (0 or > 64)", () => {
    assert.throws(
      () => validateConfigurationChange(baseSpec, { cpuCores: 0, ramGb: 8, storageGb: 50 }),
      /Requested CPU cores must be between 1 and 64/,
    );
    assert.throws(
      () => validateConfigurationChange(baseSpec, { cpuCores: 128, ramGb: 8, storageGb: 50 }),
      /Requested CPU cores must be between 1 and 64/,
    );
  });

  it("rejects RAM outside bounds (0 or > 512 GB)", () => {
    assert.throws(
      () => validateConfigurationChange(baseSpec, { cpuCores: 4, ramGb: 0, storageGb: 50 }),
      /Requested RAM must be between 1 and 512 GB/,
    );
    assert.throws(
      () => validateConfigurationChange(baseSpec, { cpuCores: 4, ramGb: 1024, storageGb: 50 }),
      /Requested RAM must be between 1 and 512 GB/,
    );
  });

  it("rejects storage outside bounds (< 10 GB or > 10240 GB)", () => {
    assert.throws(
      () => validateConfigurationChange(baseSpec, { cpuCores: 4, ramGb: 8, storageGb: 5 }),
      /Requested storage must be between 10 and 10240 GB/,
    );
  });

  it("accepts valid upgrade/downgrade configurations", () => {
    assert.doesNotThrow(() =>
      validateConfigurationChange(baseSpec, { cpuCores: 4, ramGb: 8, storageGb: 100 }),
    );
  });
});

// ── 4. Approval & Duplicate Request Prevention ──────────────────────────────

describe("UpgradesService — Gated approvals & duplicate request prevention", () => {
  function createMockRepos() {
    const vm = {
      id: "vm-123",
      customer_id: "cust-abc",
      state: "RUNNING",
      vm_config: { cpuCores: 2, ramGb: 4, storageGb: 50, os: "Ubuntu" },
    };

    let activeRequest = null;
    let requestStore = null;
    let events = [];

    const mockVmsRepo = {
      findById: async (id) => (id === vm.id ? { ...vm } : null),
      updateState: async (id, state) => {
        vm.state = state;
        return { ...vm };
      },
      updateConfig: async (id, config) => {
        vm.vm_config = config;
        return { ...vm };
      },
      recordEvent: async (ev) => {
        events.push(ev);
        return { id: "ev-" + events.length, ...ev };
      },
    };

    const mockUpgradesRepo = {
      create: async (params) => {
        requestStore = {
          id: "req-999",
          customer_id: params.customerId,
          vm_id: params.vmId,
          old_configuration: params.oldConfig,
          new_configuration: params.newConfig,
          old_monthly_price: String(params.oldMonthlyPrice),
          new_monthly_price: String(params.newMonthlyPrice),
          price_difference: String(params.priceDifference),
          status: "PENDING_APPROVAL",
          customer_confirmed_at: new Date(),
          provider_approved_at: null,
          approved_by: null,
          attempt_count: 0,
          max_attempts: 3,
        };
        activeRequest = requestStore;
        return { ...requestStore };
      },
      findById: async (id) => (requestStore && requestStore.id === id ? { ...requestStore } : null),
      findActiveByVmId: async (vmId) => (activeRequest && activeRequest.vm_id === vmId ? { ...activeRequest } : null),
      updateStatus: async (id, status, fields = {}) => {
        requestStore = { ...requestStore, status, ...fields };
        if (status === "COMPLETED" || status === "FAILED" || status === "REJECTED") {
          activeRequest = null;
        } else {
          activeRequest = requestStore;
        }
        return { ...requestStore };
      },
      recordAttempt: async (id, attempt) => {
        if (requestStore) requestStore.attempt_count = attempt;
      },
    };

    return { vm, mockVmsRepo, mockUpgradesRepo, events, getRequest: () => requestStore };
  }

  it("creates upgrade request in PENDING_APPROVAL state", async () => {
    const { mockVmsRepo, mockUpgradesRepo } = createMockRepos();
    const provider = new SimulatedVmProvider(0);
    const service = new UpgradesService(mockUpgradesRepo, mockVmsRepo, provider);

    const req = await service.requestUpgrade("vm-123", {
      customerId: "cust-abc",
      cpuCores: 4,
      ramGb: 8,
      storageGb: 100,
    });

    assert.equal(req.status, "PENDING_APPROVAL");
    assert.equal(req.price_difference, "23");
    assert.ok(req.customer_confirmed_at);
    assert.equal(req.provider_approved_at, null);
  });

  it("blocks duplicate active upgrade requests for the same VM", async () => {
    const { mockVmsRepo, mockUpgradesRepo } = createMockRepos();
    const provider = new SimulatedVmProvider(0);
    const service = new UpgradesService(mockUpgradesRepo, mockVmsRepo, provider);

    await service.requestUpgrade("vm-123", {
      customerId: "cust-abc",
      cpuCores: 4,
      ramGb: 8,
      storageGb: 100,
    });

    // Second request should throw ConflictException
    await assert.rejects(
      () =>
        service.requestUpgrade("vm-123", {
          customerId: "cust-abc",
          cpuCores: 8,
          ramGb: 16,
          storageGb: 200,
        }),
      /An active upgrade request .* already exists for this VM/,
    );
  });

  it("allows provider approval which applies resize and completes", async () => {
    const { mockVmsRepo, mockUpgradesRepo, vm } = createMockRepos();
    const provider = new SimulatedVmProvider(0);
    const service = new UpgradesService(mockUpgradesRepo, mockVmsRepo, provider);

    const req = await service.requestUpgrade("vm-123", {
      customerId: "cust-abc",
      cpuCores: 4,
      ramGb: 8,
      storageGb: 100,
    });

    const result = await service.approveUpgrade(req.id, { providerId: "admin-provider" });

    assert.equal(result.status, "COMPLETED");
    assert.equal(result.approved_by, "admin-provider");
    // Verify VM config was updated
    assert.equal(vm.vm_config.cpuCores, 4);
    assert.equal(vm.vm_config.ramGb, 8);
    assert.equal(vm.vm_config.storageGb, 100);
    // Verify VM state was restored to RUNNING
    assert.equal(vm.state, "RUNNING");
  });

  it("allows provider rejection without modifying VM configuration", async () => {
    const { mockVmsRepo, mockUpgradesRepo, vm } = createMockRepos();
    const provider = new SimulatedVmProvider(0);
    const service = new UpgradesService(mockUpgradesRepo, mockVmsRepo, provider);

    const req = await service.requestUpgrade("vm-123", {
      customerId: "cust-abc",
      cpuCores: 4,
      ramGb: 8,
      storageGb: 100,
    });

    const rejected = await service.rejectUpgrade(req.id, {
      providerId: "admin-provider",
      reason: "High host load in cluster",
    });

    assert.equal(rejected.status, "REJECTED");
    assert.equal(rejected.rejection_reason, "High host load in cluster");
    // VM config untouched
    assert.equal(vm.vm_config.cpuCores, 2);
    assert.equal(vm.state, "RUNNING");
  });
});

// ── 5. Retry & Rollback on Resize Failure ───────────────────────────────────

describe("UpgradesService — Retry and Rollback behavior on failure", () => {
  it("rolls back VM state and restores original configuration on persistent provider error", async () => {
    const originalConfig = { cpuCores: 2, ramGb: 4, storageGb: 50, os: "Ubuntu" };
    const vm = {
      id: "vm-fail-1",
      customer_id: "cust-1",
      state: "RUNNING",
      vm_config: { ...originalConfig },
    };

    let events = [];
    let requestStore = {
      id: "req-fail-9",
      customer_id: "cust-1",
      vm_id: vm.id,
      old_configuration: { ...originalConfig },
      new_configuration: { cpuCores: 8, ramGb: 16, storageGb: 100 },
      status: "APPROVED",
      customer_confirmed_at: new Date(),
      provider_approved_at: new Date(),
      approved_by: "admin",
      attempt_count: 0,
      max_attempts: 3,
    };

    const mockVmsRepo = {
      findById: async () => ({ ...vm }),
      updateState: async (id, state) => {
        vm.state = state;
        return { ...vm };
      },
      updateConfig: async (id, config) => {
        vm.vm_config = config;
        return { ...vm };
      },
      recordEvent: async (ev) => {
        events.push(ev);
        return { id: "ev-" + events.length, ...ev };
      },
    };

    const mockUpgradesRepo = {
      create: async () => requestStore,
      findById: async () => requestStore,
      findActiveByVmId: async () => null,
      updateStatus: async (id, status, fields = {}) => {
        requestStore = { ...requestStore, status, ...fields };
        return { ...requestStore };
      },
      recordAttempt: async (id, attempt) => {
        requestStore.attempt_count = attempt;
      },
    };

    // Provider that always fails resize simulation
    const failingProvider = {
      checkCapacity: async () => ({ available: true }),
      provision: async () => ({ simulatedVmId: "", hostname: "", ipAddress: "" }),
      resize: async () => {
        throw new Error("Simulated hypervisor hardware failure during resize");
      },
    };

    const service = new UpgradesService(mockUpgradesRepo, mockVmsRepo, failingProvider);

    const result = await service.applyResizeJob(requestStore);

    // 1. Request status is marked FAILED
    assert.equal(result.status, "FAILED");
    assert.match(result.last_error, /Simulated hypervisor hardware failure/);

    // 2. VM configuration remains original (NOT updated to 8 vCPU / 16 GB)
    assert.deepEqual(vm.vm_config, originalConfig);

    // 3. VM state is rolled back to original RUNNING state (not stuck in RESIZING)
    assert.equal(vm.state, "RUNNING");

    // 4. State events record both RESIZE_START and RESIZE_ROLLED_BACK
    const rollbackEvent = events.find((e) => e.action === "RESIZE_ROLLED_BACK");
    assert.ok(rollbackEvent, "RESIZE_ROLLED_BACK event must be recorded in audit log");
    assert.equal(rollbackEvent.fromState, "RESIZING");
    assert.equal(rollbackEvent.toState, "RUNNING");
  });
});
