# CP-08 provider reporting and commercial analytics

All routes below are under `/api/v1`, require the existing cookie session, an active user, a `provider_admin` or `provider_staff` global role, and membership in the requested active organization. Mutating routes also require the existing CSRF header and use the existing `Idempotency-Key` convention.

`organizationId` is required on every provider route. It is an authorization input, not a trust boundary: every query also scopes its SQL joins by organization ownership. `from` is inclusive and `to` is exclusive (`[from,to)`). Both are ISO-8601 timestamps, and a custom window cannot exceed 366 days. Monetary values remain decimal strings and are never summed across currencies.

## Routes

| Method | Route | Purpose | Access |
| --- | --- | --- | --- |
| GET | `/provider/dashboard` | Current provider KPIs, currency-grouped financial facts, and recent activity | Provider staff/admin member |
| GET | `/provider/customers` | Distinct customer relationships with bounded pagination | Provider staff/admin member |
| GET | `/provider/customers/:id` | Customer relationship detail, scoped deals/orders/VMs | Provider staff/admin member |
| GET | `/provider/deals` | Filterable, deterministic offer/deal list | Provider staff/admin member |
| GET | `/provider/deals/:id` | Deal, pricing/policy evidence, requirements, safe transcript, events and approvals | Provider staff/admin member |
| POST | `/provider/deals/:id/override` | Immutable revised offer for an unexpired pending-review deal | Provider admin with organization owner/admin membership |
| GET | `/provider/orders` | Organization-scoped accepted order and payment/provisioning summary | Provider staff/admin member |
| GET | `/provider/vms` | Organization-scoped VM and provisioning visibility | Provider staff/admin member |
| GET | `/provider/invoices` | Provider-attributed invoice components with pagination | Provider staff/admin member |
| GET | `/provider/pricing/history` | Historical pricing versions, rules and offer/order reference counts | Provider staff/admin member |
| GET | `/provider/pricing/history/:id` | One authorized pricing version and retained rules | Provider staff/admin member |
| GET | `/provider/activity` | Organization-scoped audit activity summaries | Provider staff/admin member |
| GET | `/provider/analytics/overview` | Dashboard KPI contract | Provider staff/admin member |
| GET | `/provider/analytics/revenue` | Currency-grouped invoice facts and monthly trend | Provider staff/admin member |
| GET | `/provider/analytics/deals` | Deal status counts and distinct-customer funnel | Provider staff/admin member |
| GET | `/provider/analytics/discounts` | Offered versus accepted discount statistics | Provider staff/admin member |
| GET | `/provider/analytics/vms` | VM state distribution and provisioning failures | Provider staff/admin member |
| GET | `/provider/analytics/billing` | Currency-grouped balances and invoice status counts | Provider staff/admin member |

## Query and pagination

Common query fields are `organizationId`, `from`, `to`, `page` (default 1, maximum 100), and `pageSize` (default 25, maximum 100). Deal/order filters include `status`, `customerId`, `pricingVersionId`, `vmTemplateId`, `currency`, `billingCycle`, `minDiscountPercent`, and `maxDiscountPercent`. VM status filters the persisted lifecycle state. Sorting is server-defined and deterministic: newest business timestamp followed by UUID.

List responses use `{ data, pagination: { page, pageSize, total } }`.

## KPI definitions and provenance

| KPI | Authoritative source and calculation |
| --- | --- |
| `totalCustomers` | Distinct `customer_id` from provider-owned `offers` or `orders`; no repeat count for counteroffers or invoices. |
| `activeVirtualMachines` | `virtual_machines` joined through provider-owned `orders` with current state `RUNNING`; stopped, suspended, provisioning, failed and terminated machines are not active. |
| `pendingDealReviews` | Current `offers.status = 'pending_provider_review'`; expired rows are reconciled by the existing offer workflow and never counted as historical pending rows. |
| `acceptedOffers` | `offers.status = 'accepted'`, using `accepted_at` for a requested window. |
| `completedOrders` | Provider-owned `orders.status = 'completed'`, using `accepted_at` for the current schema. |
| `failedProvisioningJobs` | Provider-owned order joins where `provisioning_jobs.status = 'FAILED'`. |
| `invoicedAmount` | Issued, non-void initial invoice totals for provider-owned orders plus recurring invoice amounts attributed from provider-owned VM/order charge lines. Single-provider headers are taken in full; shared headers, including persisted adjustments, are allocated proportionally. Different currencies remain separate. |
| `verifiedSimulatedPayments` | Sum of `payment_records.amount` only where `status = 'verified'` and the invoice is attributable to one provider. Shared-invoice settlement is deliberately unallocated. |
| `outstandingAmount` | Eligible invoice balance, `total - amount_paid`; shared recurring headers are allocated proportionally to provider charge lines. |
| `overdueAmount` | The same eligible balance only where persisted invoice status is `overdue`. |
| `averageAcceptedDiscountPercent` | Average `offers.discount_percent` for accepted offers, using `accepted_at`; it is not an average of counteroffers. |
| Conversion funnel | Distinct customers at each persisted offer/order/payment stage. `providerApproved` requires an `offer_approvals.decision = 'approved'` row; an accepted offer alone is not provider approval. The report is an observation of records in the selected offer-created cohort, not a causal conversion claim. |
| VM analytics | Current `virtual_machines.state`, `activeVirtualMachines` equal to the `RUNNING` bucket, and provisioning job status. Historical state-at-time reporting is not inferred from current state. |

The API intentionally does not expose recognized revenue or margin. Invoices, usage charges and simulated collections are separate facts. No approved provider cost basis exists for a margin estimate, so deal detail returns `marginEstimate: null`.

## Override contract

`POST /provider/deals/:id/override` accepts `{ "discountPercent": "7.50", "reason": "..." }` and an `Idempotency-Key` header. The backend locks the negotiation session and source offer, requires `pending_provider_review`, checks expiry, currency, the retained pricing version's applicable rule ceilings/floors, the negotiation-policy ceiling/floor and approval threshold, marks the source `countered`, inserts a new immutable `presented` offer linked by `parent_offer_id`, writes offer events and an audit row, and updates the chat's active offer. The customer must still accept the revised offer through CP-06. Existing orders, invoices and pricing versions are never changed. Reusing an idempotency key with another payload fails.

Activity uses the same bounded `{ data, pagination }` contract as other lists. Its `total` is a database count, and ordering is `created_at DESC, id DESC`. Custom report windows require both `from` and `to` and use the UTC half-open interval `[from,to)`; the maximum window is 366 days. Pricing history without a window remains an all-history view.

## Example

```json
{
  "metrics": {
    "totalCustomers": 4,
    "activeVirtualMachines": 1,
    "pendingDealReviews": 1,
    "averageAcceptedDiscountPercent": "6.2500"
  },
  "financialsByCurrency": [
    {
      "currency": "USD",
      "invoiceCount": 3,
      "invoicedAmount": "180.0000",
      "verifiedSimulatedPayments": "100.0000",
      "outstandingAmount": "80.0000",
      "overdueAmount": "20.0000",
      "sharedInvoiceCount": 0
    }
  ],
  "window": { "from": null, "to": null, "interval": "[from,to)" }
}
```

Errors use the repository envelope. Common responses are `400` for invalid dates/filters, `401` for missing/expired sessions, `403` for role or membership failure, `404` for an object outside the authorized organization, and `409` for expired/stale/idempotency/policy conflicts.

## Traceability

| Requirement | Implementation |
| --- | --- |
| Provider dashboard and administration | `provider` module controllers/services/repository |
| Grounded aggregates and trends | `analytics` module plus provider attribution CTE |
| Pricing history | `pricing_versions`/`pricing_rules` read path; existing pricing mutation services remain authoritative |
| Deal review | Existing CP-05 approval routes remain authoritative; CP-08 adds scoped detail/evidence |
| Manual override | Immutable successor offer, `offer_events`, existing `audit_logs`, and idempotency key |
| Provider isolation | Active membership service check plus organization predicates in every query |
| Financial safety | Per-currency result groups, no line-item header multiplication, shared recurring allocation semantics |
