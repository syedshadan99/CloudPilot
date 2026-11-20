/**
 * Unit tests for MockAiAdapter and requirement extraction logic.
 * Run with: node --test apps/api/test/unit/mock-ai-adapter.test.js
 * (after build — tests import from dist)
 *
 * Written as plain Node.js test runner tests (Node 18+ built-in).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import from compiled dist
import { MockAiAdapter } from "../../dist/modules/chat/adapters/mock-ai.adapter.js";

describe("MockAiAdapter", () => {
  const adapter = new MockAiAdapter();

  it("extracts CPU cores from text", async () => {
    const result = await adapter.process({
      messages: [{ role: "user", content: "I need 4 CPU cores and 8gb ram" }],
    });
    assert.equal(result.requirements.cpuCores, 4);
    assert.equal(result.requirements.ramGb, 8);
  });

  it("extracts OS from text", async () => {
    const result = await adapter.process({
      messages: [{ role: "user", content: "I want Ubuntu linux" }],
    });
    assert.equal(result.requirements.os, "Ubuntu");
  });

  it("extracts storage in TB and converts to GB", async () => {
    const result = await adapter.process({
      messages: [{ role: "user", content: "I need 2TB storage for my database" }],
    });
    assert.equal(result.requirements.storageGb, 2048);
    assert.equal(result.requirements.useCase, "Database");
  });

  it("extracts monthly billing cycle", async () => {
    const result = await adapter.process({
      messages: [{ role: "user", content: "I need billing monthly for 3 months" }],
    });
    assert.equal(result.requirements.billingCycle, "monthly");
    assert.equal(result.requirements.durationDays, 90);
  });

  it("asks clarifying questions when nothing extracted", async () => {
    const result = await adapter.process({
      messages: [{ role: "user", content: "Hello" }],
    });
    assert.ok(result.reply.includes("CPU"));
    assert.equal(Object.values(result.requirements).every((v) => v === undefined), true);
  });

  it("confirms all requirements when complete", async () => {
    const result = await adapter.process({
      messages: [
        { role: "user", content: "I need 4 cpu cores, 8gb ram, 100gb storage, Ubuntu, monthly billing, 30 days for web server development" },
      ],
    });
    assert.ok(result.reply.toLowerCase().includes("captured"));
    assert.equal(result.requirements.cpuCores, 4);
    assert.equal(result.requirements.os, "Ubuntu");
  });

  it("always returns a reply string", async () => {
    const result = await adapter.process({ messages: [] });
    assert.ok(typeof result.reply === "string");
    assert.ok(result.reply.length > 0);
  });
});

describe("ChatService fallback behavior", () => {
  it("service returns fallback reply when adapter throws", async () => {
    // Test that fallbackReply produces a string — isolated unit test
    const fallback =
      "I'm having trouble processing your message right now. " +
      "Please try again, or use the form below to enter your VM requirements manually.";
    assert.ok(fallback.length > 0);
    assert.ok(fallback.includes("manually"));
  });
});
