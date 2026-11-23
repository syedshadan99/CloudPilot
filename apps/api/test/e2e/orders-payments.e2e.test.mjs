import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.CP06_E2E_BASE_URL;

function cookieValue(setCookies, name) {
  const item = setCookies.find((value) => value.startsWith(`${name}=`));
  return item?.split(";", 1)[0].slice(name.length + 1);
}

function cookieHeader(setCookies) { return setCookies.map((value) => value.split(";", 1)[0]).join("; "); }

test("CP-06 customer can read owned orders/invoices and cannot use forged payment authority", { skip: !baseUrl ? "Set CP06_E2E_BASE_URL for a running API and disposable seeded database" : false }, async () => {
  const origin = process.env.CP06_E2E_ORIGIN ?? "http://localhost:5173";
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify({ email: "customer.demo@cloudpilot.invalid", password: "cloudpilot-demo-only" }) });
  assert.equal(login.status, 200);
  const cookies = login.headers.getSetCookie();
  const cookie = cookieHeader(cookies);
  const csrf = cookieValue(cookies, "cloudpilot_csrf");
  const orders = await fetch(`${baseUrl}/api/v1/orders`, { headers: { origin, cookie } });
  assert.equal(orders.status, 200);
  const invoices = await fetch(`${baseUrl}/api/v1/invoices`, { headers: { origin, cookie } });
  assert.equal(invoices.status, 200);
  const forged = await fetch(`${baseUrl}/api/v1/payments/simulated`, { method: "POST", headers: { "content-type": "application/json", origin, cookie, "x-csrf-token": csrf, "idempotency-key": `cp06-forged-${Date.now()}` }, body: JSON.stringify({ invoiceId: "00000000-0000-0000-0000-000000000000", amount: "999999.0000", currency: "USD", paymentStatus: "verified", success: true }) });
  assert.equal(forged.status, 400);
});
