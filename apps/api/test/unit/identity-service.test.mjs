import assert from "node:assert/strict";
import test from "node:test";
import { IdentityService } from "../../dist/modules/identity/services/identity.service.js";
import { PasswordService } from "../../dist/modules/identity/services/password.service.js";
import { RateLimiterService } from "../../dist/modules/identity/services/rate-limiter.service.js";

const config = {
  passwordBcryptRounds: 10,
  verificationTokenTtlSeconds: 3600,
  passwordResetTokenTtlSeconds: 3600,
  session: { ttlSeconds: 604800, idleSeconds: 86400 },
  csrfSecret: "test-secret-that-is-at-least-32-characters-long",
};

function user(overrides = {}) {
  return {
    id: "user-1", full_name: "Test Customer", email: "test@example.com",
    normalized_email: "test@example.com", password_hash: "unused", role: "customer",
    status: "pending_verification", email_verified_at: null,
    terms_accepted_at: new Date(), last_login_at: null, created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}

test("registration always returns a customer-safe response without raw verification token", async () => {
  const password = new PasswordService(config);
  const hash = await password.hash("a sufficiently long password");
  let captured;
  const repo = {
    async createRegistration() { return { user: user({ password_hash: hash }), verificationTokenExpiresAt: new Date() }; },
  };
  const email = { async sendVerification(message) { captured = message; }, async sendPasswordReset() {} };
  const service = new IdentityService(repo, password, new RateLimiterService(), email, config);
  const result = await service.register({
    fullName: "Test Customer", email: "TEST@example.com", password: "a sufficiently long password",
    workloadType: "web hosting", preferredCurrency: "USD", termsAccepted: true,
  }, { ip: "127.0.0.1" });
  assert.equal(result.user.role, "customer");
  assert.equal(result.verificationRequired, true);
  assert.equal("token" in result, false);
  assert.match(captured.token, /^[A-Za-z0-9_-]{43}$/);
});

test("login returns a session token only to the cookie boundary", async () => {
  const password = new PasswordService(config);
  const hash = await password.hash("a sufficiently long password");
  const repo = {
    async findForLogin() { return user({ status: "active", email_verified_at: new Date(), password_hash: hash }); },
    async createSession() { return { id: "session-1", expires_at: new Date() }; },
  };
  const email = { async sendVerification() {}, async sendPasswordReset() {} };
  const service = new IdentityService(repo, password, new RateLimiterService(), email, config);
  const result = await service.login({ email: "TEST@example.com", password: "a sufficiently long password" }, { ipAddress: "127.0.0.1" });
  assert.match(result.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.user.passwordHash, undefined);
});
