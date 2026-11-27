import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.CP08_E2E_BASE_URL;
const origin = process.env.CP08_E2E_ORIGIN ?? "http://localhost:5173";
const org = "10000000-0000-0000-0000-000000000001";
const otherOrg = "10000000-0000-0000-0000-000000000002";
const offer = "90000000-0000-0000-0000-000000000001";

function cookieHeader(values) { return values.map((value) => value.split(";", 1)[0]).join("; "); }

test("CP-08 provider workflow and organization isolation", { skip: !baseUrl ? "Set CP08_E2E_BASE_URL for a running API and disposable seeded database" : false }, async () => {
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify({ email: "provider.demo@cloudpilot.invalid", password: "cloudpilot-demo-only" }) });
  assert.equal(login.status, 200);
  const cookie = cookieHeader(login.headers.getSetCookie());
  const dashboard = await fetch(`${baseUrl}/api/v1/provider/dashboard?organizationId=${org}`, { headers: { origin, cookie } });
  assert.equal(dashboard.status, 200);
  assert.equal((await dashboard.json()).metrics.totalCustomers, 1);
  for (const path of [`provider/customers?organizationId=${org}`, `provider/deals?organizationId=${org}`, `provider/deals/${offer}?organizationId=${org}`, `provider/pricing/history?organizationId=${org}`, `provider/analytics/revenue?organizationId=${org}`]) {
    const response = await fetch(`${baseUrl}/api/v1/${path}`, { headers: { origin, cookie } });
    assert.equal(response.status, 200, path);
  }
  const crossTenant = await fetch(`${baseUrl}/api/v1/provider/dashboard?organizationId=${otherOrg}`, { headers: { origin, cookie } });
  assert.equal(crossTenant.status, 403);
});
