import assert from "node:assert/strict";
import test from "node:test";
import { ProviderService } from "../../dist/modules/provider/provider.service.js";
import { ForbiddenException, BadRequestException } from "@nestjs/common";

const principal = { userId: "provider-1", role: "provider_staff", status: "active" };

function service(overrides = {}) {
  const repo = {
    dashboardCounts: async () => ({ total_customers: "2", active_vms: "1", pending_deal_reviews: "3", accepted_offers: "4", completed_orders: "2", failed_provisioning_jobs: "0", issued_initial_invoices: "4", average_accepted_discount: "7.5000" }),
    financialSummary: async () => [{ currency: "USD", invoiceCount: 2, invoicedAmount: "100.0000", verifiedSimulatedPayments: "50.0000", outstandingAmount: "50.0000", overdueAmount: "0.0000", sharedInvoiceCount: 0 }],
    activity: async () => [],
    ...overrides,
  };
  const authorization = { assertOrganizationMember: async () => undefined };
  return { instance: new ProviderService(repo, authorization, {}, {}), authorization };
}

test("provider dashboard requires a provider role and uses separated currency facts", async () => {
  const { instance } = service();
  const response = await instance.dashboard(principal, { organizationId: "org-1" });
  assert.equal(response.metrics.totalCustomers, 2);
  assert.equal(response.financialsByCurrency[0].verifiedSimulatedPayments, "50.0000");
  await assert.rejects(() => instance.dashboard({ ...principal, role: "customer" }, { organizationId: "org-1" }), ForbiddenException);
});

test("provider report windows are half-open and bounded", async () => {
  const { instance } = service();
  await assert.rejects(() => instance.dashboard(principal, { organizationId: "org-1", from: "2026-01-01T00:00:00Z" }), BadRequestException);
  await assert.rejects(() => instance.dashboard(principal, { organizationId: "org-1", to: "2026-01-02T00:00:00Z" }), BadRequestException);
  await assert.rejects(() => instance.dashboard(principal, { organizationId: "org-1", from: "2026-02-01T00:00:00Z", to: "2026-01-01T00:00:00Z" }), BadRequestException);
  await assert.rejects(() => instance.dashboard(principal, { organizationId: "org-1", from: "2024-01-01T00:00:00Z", to: "2026-01-01T00:00:00Z" }), BadRequestException);
});
