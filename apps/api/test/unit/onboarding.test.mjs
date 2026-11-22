import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { OnboardingService } from "../../dist/modules/onboarding/onboarding.service.js";

function row(overrides = {}) {
  return {
    user_id: "user-1",
    current_step: "welcome",
    status: "not_started",
    responses: {},
    completed_at: null,
    updated_at: new Date("2026-11-22T10:00:00.000Z"),
    ...overrides,
  };
}

function setup(initial = row()) {
  let current = initial;
  const repo = {
    async findByUserId() { return current; },
    async updateProgress(_userId, _expected, input) {
      current = row({ ...current, current_step: input.currentStep, status: input.status, responses: input.responses, updated_at: new Date() });
      return current;
    },
    async complete() {
      if (current.status === "completed") return { progress: current, incomplete: false };
      const required = ["workload", "duration_days", "billing_cycle", "technical_level"];
      if (!required.every((key) => current.responses[key] != null)) return { progress: current, incomplete: true };
      current = row({ ...current, current_step: "complete", status: "completed", completed_at: new Date(), updated_at: new Date() });
      return { progress: current, incomplete: false };
    },
  };
  const identity = { async assertActiveCustomer() {} };
  return { service: new OnboardingService(repo, identity), repo };
}

test("onboarding saves partial progress and supports resume", async () => {
  const { service } = setup();
  const updated = await service.update("user-1", { currentStep: "workload", workloadType: "web hosting" });
  assert.equal(updated.currentStep, "workload");
  assert.equal(updated.responses.workload, "web hosting");
});

test("onboarding rejects step jumps and incomplete completion", async () => {
  const { service } = setup();
  await assert.rejects(
    service.update("user-1", { currentStep: "billing" }),
    (error) => error instanceof BadRequestException,
  );
  await assert.rejects(
    service.complete("user-1"),
    (error) => error instanceof BadRequestException,
  );
});

test("onboarding completion is idempotent after all required answers exist", async () => {
  const { service } = setup(row({
    current_step: "expertise",
    status: "in_progress",
    responses: {
      workload: "web hosting",
      duration_days: 30,
      billing_cycle: "monthly",
      technical_level: "intermediate",
    },
  }));
  const first = await service.complete("user-1");
  const second = await service.complete("user-1");
  assert.equal(first.status, "completed");
  assert.equal(second.status, "completed");
});

test("completed onboarding cannot be mass-edited", async () => {
  const { service } = setup(row({ current_step: "complete", status: "completed", completed_at: new Date() }));
  await assert.rejects(
    service.update("user-1", { workloadType: "custom" }),
    (error) => error instanceof ConflictException,
  );
});
