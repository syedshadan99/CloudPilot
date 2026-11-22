import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { PasswordService } from "../../dist/modules/identity/services/password.service.js";
import { RateLimiterService } from "../../dist/modules/identity/services/rate-limiter.service.js";
import { generateToken, hashToken } from "../../dist/modules/identity/services/token.service.js";

const config = {
  passwordBcryptRounds: 10,
};

test("bcryptjs verifies PostgreSQL pgcrypto-compatible $2a$ demo hashes", async () => {
  const service = new PasswordService(config);
  const pgcryptoStyleHash = bcrypt.hashSync(
    "cloudpilot-demo-only",
    "$2a$10$abcdefghijklmnopqrstuu",
  );

  assert.equal(await service.verify("cloudpilot-demo-only", pgcryptoStyleHash), true);
  assert.equal(await service.verify("wrong-password", pgcryptoStyleHash), false);
});

test("new password hashes are salted and never equal the plaintext", async () => {
  const service = new PasswordService(config);
  const hash = await service.hash("a sufficiently long password");
  assert.notEqual(hash, "a sufficiently long password");
  assert.match(hash, /^\$2[aby]\$10\$/);
  assert.equal(await service.verify("a sufficiently long password", hash), true);
});

test("session and recovery tokens are high entropy and only their digest is persisted", () => {
  const token = generateToken();
  assert.match(token.raw, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(token.hash, hashToken(token.raw));
  assert.notEqual(token.raw, token.hash);
  assert.equal(token.hash.length, 64);
});

test("sensitive actions are throttled with HTTP 429", () => {
  const limiter = new RateLimiterService();
  limiter.consume("test", 1, 60_000);
  assert.throws(() => limiter.consume("test", 1, 60_000), (error) => error.getStatus?.() === 429);
});
