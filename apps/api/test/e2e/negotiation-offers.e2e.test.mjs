import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.CP05_E2E_BASE_URL;

function cookieValue(setCookies, name) {
  const item = setCookies.find((value) => value.startsWith(`${name}=`));
  return item?.split(";", 1)[0].slice(name.length + 1);
}

function cookieHeader(setCookies) {
  return setCookies.map((value) => value.split(";", 1)[0]).join("; ");
}

test("HTTP customer negotiation, offer retrieval and decline workflow", { skip: !baseUrl ? "Set CP05_E2E_BASE_URL for a running API and disposable seeded database" : false }, async () => {
  const origin = process.env.CP05_E2E_ORIGIN ?? "http://localhost:5173";
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email: "customer.demo@cloudpilot.invalid", password: "cloudpilot-demo-only" }),
  });
  assert.equal(login.status, 200);
  const setCookies = login.headers.getSetCookie();
  const csrf = cookieValue(setCookies, "cloudpilot_csrf");
  const cookies = cookieHeader(setCookies);
  assert.ok(csrf);

  const idempotencyKey = `cp05-e2e-${Date.now()}`;
  const start = await fetch(`${baseUrl}/api/v1/negotiations`, {
    method: "POST", headers: { "content-type": "application/json", origin, cookie: cookies, "x-csrf-token": csrf, "idempotency-key": idempotencyKey },
    body: JSON.stringify({ chatSessionId: "80000000-0000-0000-0000-000000000003", templateId: "40000000-0000-0000-0000-000000000002", billingCycle: "monthly", rentalDurationDays: 30, requestedDiscountPercent: "0.00" }),
  });
  assert.equal(start.status, 201);
  const started = await start.json();
  assert.equal(started.offer.pricing.finalPrice, started.offer.pricing.basePrice);

  const detail = await fetch(`${baseUrl}/api/v1/offers/${started.offer.id}`, { headers: { origin, cookie: cookies } });
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).id, started.offer.id);

  const decline = await fetch(`${baseUrl}/api/v1/offers/${started.offer.id}/decline`, {
    method: "POST", headers: { "content-type": "application/json", origin, cookie: cookies, "x-csrf-token": csrf, "idempotency-key": `${idempotencyKey}-decline` },
    body: JSON.stringify({ reason: "HTTP E2E cleanup" }),
  });
  assert.equal(decline.status, 201);
  assert.equal((await decline.json()).offer.status, "declined");
});
