# CP-05 negotiation and offers API

All routes are prefixed by `/api/v1`. Existing session-cookie authentication,
global role guards and session-bound CSRF validation apply. Mutating browser
requests must include the allowed `Origin` and `X-CSRF-Token`. Side-effecting
commands require an `Idempotency-Key` header between 8 and 200 characters.

## Customer routes

| Method | Route | Access |
| --- | --- | --- |
| POST | `/negotiations` | Active customer |
| POST | `/negotiations/:chatSessionId/counter` | Owner of the negotiation chat session |
| GET | `/negotiations/:chatSessionId` | Owner of the negotiation chat session |
| GET | `/negotiations/:chatSessionId/history` | Owner of the negotiation chat session |
| GET | `/offers` | Active customer; own records only |
| GET | `/offers/:id` | Offer owner only |
| GET | `/offers/:id/events` | Offer owner only |
| POST | `/offers/:id/decline` | Offer owner; actionable offer only |

The negotiation identifier is the existing `chat_sessions.id`; CP-05 does not
invent a second aggregate identifier or table. The chat session must have
`session_type='negotiation'` and belong to the authenticated customer.

### Start request

```json
{
  "chatSessionId": "uuid",
  "templateId": "uuid",
  "billingCycle": "monthly",
  "rentalDurationDays": 30,
  "requestedDiscountPercent": "8.00",
  "reason": "Long-term development workload"
}
```

The template, organization, active pricing version, effective policy, rate
rules, capacity snapshot and currency are resolved server-side. For a custom
configuration, `organizationId`, `cpuCores`, `ramGb`, `storageGb`,
`storageType`, `operatingSystem`, `bandwidthMbps` and `region` are required.
The service can fill configuration and duration fields from the owned chat
session requirements. Client fields such as base price, pricing version,
policy version, maximum discount, final total, status, expiry and actor are
rejected as unknown DTO fields or ignored as authoritative inputs.

`requestedPrice` may be sent instead of a percentage. Sending both is allowed
only when they describe exactly the same four-decimal result after the
two-decimal percentage rule; otherwise the request is rejected with `400`.

### Counter request

`POST /negotiations/:chatSessionId/counter` accepts:

```json
{
  "requestedDiscountPercent": "12.00",
  "reason": "Please consider a longer commitment"
}
```

The current presented or provider-approved offer is locked. If the terms are
outside the automatic boundary but above the hard floor, the deterministic
maximum permitted terms are returned as a new offer and the old offer is
marked `countered`. A result below the approval threshold is stored as
`pending_provider_review`; a hard floor violation is never approved by a
customer request. Attempts are counted per chat session, not per browser.

Responses contain the customer-safe offer snapshot and outcome. Provider rule
metadata, margins and the persisted commercial snapshot are not returned to
customers.

## Provider routes

| Method | Route | Access |
| --- | --- | --- |
| GET | `/provider/offers/pending-review?organizationId=uuid` | Provider admin/staff who belongs to the organization |
| POST | `/provider/offers/:id/approve?organizationId=uuid` | Scoped provider admin/staff reviewer |
| POST | `/provider/offers/:id/reject?organizationId=uuid` | Scoped provider admin/staff reviewer |

Approval and rejection require a non-empty reason. The offer is locked and
server time is checked before the decision. An offer from another provider,
already decided offer, or expired offer cannot be reviewed. Every decision is
stored in `offer_approvals` and `offer_events` in the same transaction.

## Financial rules and precision

The existing `PricingService.authoritativeQuote` resolves one effective
pricing version and exact-money quote in the same PostgreSQL transaction that
creates the offer. Money uses scaled `bigint` values at four decimal places;
discount percentages are accepted and persisted at two decimal places. The
discount amount is half-up quantized to four decimal places and the database
equation remains exact:

`final_price = base_price - discount_amount`

The applicable ceiling is the smaller of the active policy ceiling and all
applicable pricing-rule ceilings. The applicable floor is the larger of the
policy and pricing-rule floors. A final price below the policy approval
threshold requires provider review, while a price below the hard floor is not
presented as an approved deal. Hourly, daily and fixed-30-day monthly billing
reuse the CP-04 period rules.

## Offer lifecycle

| From | Allowed next state | Authority |
| --- | --- | --- |
| `draft` | `presented`, `pending_provider_review`, `cancelled` | Negotiation engine/provider |
| `presented` | `countered`, `declined`, `expired`, `cancelled` | Customer/expiry |
| `pending_provider_review` | `approved`, `rejected`, `expired`, `cancelled`, `countered` | Provider/expiry/customer revision |
| `approved` | `countered`, `declined`, `expired`, `cancelled` | Customer/expiry |
| `accepted` | none | Reserved for CP-06 atomic order transaction |
| `countered`, `declined`, `expired`, `rejected`, `cancelled` | none | Terminal |

`countered` means the prior proposal was superseded; the successor is the only
actionable offer for the chat session. A partial unique index prevents two
simultaneous actionable offers. `offer_events` is append-only. CP-05 does not
implement `POST /offers/:id/confirm`; a successful confirmation must be added
with CP-06's order and initial-invoice transaction.

## Idempotency, expiry and errors

Idempotency is stored in `idempotency_keys` with an actor/aggregate-scoped
operation and request hash. Reusing a key with different content returns `409`.
Negotiation commands, declines and provider decisions commit their idempotency
result together with the business change. A retry with the same key returns the
stored response.

Offers expire after the backend-controlled 30-minute TTL. The database/server
clock is authoritative. Customer reads and mutations, provider decisions, the
CP-06 eligibility check, and the worker all apply the hard expiry guard even
when the worker has not yet run. Expiry uses `FOR UPDATE SKIP LOCKED`, a status
predicate and an append-only event, so replay and concurrent workers are safe.

Common responses are `400` validation, `401` missing session, `403` role or
organization failure, `404` scoped record absence, and `409` commercial,
idempotency, expiry or state conflict.
