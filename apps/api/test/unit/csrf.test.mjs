import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { ForbiddenException } from "@nestjs/common";
import { CsrfGuard } from "../../dist/common/guards/csrf.guard.js";

const raw = "A".repeat(43);
const secret = "csrf-test-secret-that-is-at-least-32-characters";
const csrf = createHmac("sha256", secret).update(raw).digest("base64url");
const config = {
  corsOrigin: "http://localhost:5173",
  csrfSecret: secret,
  session: { cookieName: "cloudpilot_session" },
};

function context(request) {
  return { switchToHttp: () => ({ getRequest: () => request }) };
}

test("valid session-bound CSRF header and allowed origin pass", () => {
  const guard = new CsrfGuard(config);
  const request = {
    method: "PATCH",
    headers: {
      origin: "http://localhost:5173",
      cookie: `cloudpilot_session=${raw}; cloudpilot_csrf=${csrf}`,
      "x-csrf-token": csrf,
    },
  };
  assert.equal(guard.canActivate(context(request)), true);
});

test("missing token or untrusted origin is rejected", () => {
  const guard = new CsrfGuard(config);
  const request = {
    method: "POST",
    headers: { origin: "https://evil.example", cookie: `cloudpilot_session=${raw}` },
  };
  assert.throws(() => guard.canActivate(context(request)), (error) => error instanceof ForbiddenException);
});

test("safe requests do not require a CSRF token", () => {
  const guard = new CsrfGuard(config);
  assert.equal(guard.canActivate(context({ method: "GET", headers: {} })), true);
});
