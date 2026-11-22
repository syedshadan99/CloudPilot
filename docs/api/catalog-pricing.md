# CP-04 catalog, capacity, pricing and policy API

All routes below are prefixed by `/api/v1`. The existing opaque session cookie,
global role guard and session-bound CSRF guard remain authoritative. Mutating
browser requests must send `X-CSRF-Token` and an allowed `Origin`.

Provider routes require a `provider_admin` or `provider_staff` session and an
`organizationId` query/body value that is checked against
`AuthorizationService.assertOrganizationMember`. Writes additionally require
the global `provider_admin` role and an `owner` or `admin` organization
membership. A global role is not sufficient to access another organization.

## Customer catalog

| Method | Route | Access |
| --- | --- | --- |
| GET | `/vm-templates` | Active customer |
| GET | `/vm-templates/:id` | Active customer |

`GET /vm-templates` supports `region`, `operatingSystem`, `minCpuCores`,
`minRamGb`, `minStorageGb`, `storageType`, `availability`, `includeUnavailable`,
`page`, and `pageSize`. The default view includes only active, non-retired
templates whose availability is `available` or `limited`. Provider names and a
public pricing summary are returned; private pricing rules, margins and policy
history are not.

## Provider catalog and capacity

| Method | Route | Access |
| --- | --- | --- |
| GET | `/provider/vm-templates?organizationId=...` | Provider member |
| GET | `/provider/vm-templates/:id?organizationId=...` | Provider member |
| POST | `/provider/vm-templates` | Provider administrator |
| PATCH | `/provider/vm-templates/:id?organizationId=...` | Provider administrator |
| POST | `/provider/vm-templates/:id/activate?organizationId=...` | Provider administrator |
| POST | `/provider/vm-templates/:id/deactivate?organizationId=...` | Provider administrator |
| POST | `/provider/vm-templates/:id/retire?organizationId=...` | Provider administrator |
| GET | `/provider/capacity-pools?organizationId=...` | Provider member |
| POST | `/provider/capacity-pools` | Provider administrator |
| GET | `/provider/capacity-pools/:id?organizationId=...` | Provider member |
| PATCH | `/provider/capacity-pools/:id?organizationId=...` | Provider administrator |
| GET | `/provider/capacity-pools/:id/availability?organizationId=...&region=...&cpuCores=...&ramGb=...&storageGb=...` | Provider member |

Template create/update validates the database bounds and product allowlists:
CPU 1–256, RAM 1–4096 GB, storage 1–65536 GB, bandwidth 1–100000 Mbps,
`hdd|ssd|nvme`, and the supported OS identifiers. Capacity pools and pricing
versions must belong to the same organization; a template's capacity pool must
also use the template region. Templates are retired rather than deleted.

Pool utilization is derived from `capacity_reservations`. `committed` rows and
unexpired `held` rows count; `released` and expired holds do not. Free values
are clamped at zero. Pool shrinking is serialized with a row lock and rejected
when it would make active allocations invalid. The availability endpoint is a
snapshot and is not an allocation reservation.

## Pricing versions, rules and quotes

| Method | Route | Access |
| --- | --- | --- |
| POST | `/pricing/quotes` | Active customer |
| GET | `/pricing/versions?organizationId=...` | Provider member |
| POST | `/pricing/versions` | Provider administrator |
| GET | `/pricing/versions/:id?organizationId=...` | Provider member |
| PATCH | `/pricing/versions/:id?organizationId=...` | Provider administrator, draft only |
| POST | `/pricing/versions/:id/activate?organizationId=...` | Provider administrator |
| POST | `/pricing/versions/:id/retire?organizationId=...` | Provider administrator |
| POST | `/pricing/versions/:id/rules?organizationId=...` | Provider administrator, draft only |
| PATCH | `/pricing/versions/:id/rules/:ruleId?organizationId=...` | Provider administrator, draft only |
| DELETE | `/pricing/versions/:id/rules/:ruleId?organizationId=...` | Provider administrator, draft only |

Pricing lifecycle is `draft → active → retired`. Active rates are immutable;
future changes use a new version. Activation obtains a PostgreSQL transaction
advisory lock per organization, verifies a `template_base` rule for every
active non-retired template, closes the preceding effective window, updates
current template references when effective now, and writes an audit record.
Concurrent activation therefore cannot select two equally current versions.

`POST /pricing/quotes` accepts a `templateId` or a complete custom
configuration, a billing cycle (`hourly`, `daily`, `monthly`) and
`rentalDurationDays`. It never accepts a client total, rate, discount or floor.
Rates are read from one effective active version and all applicable rules.
The response is explicitly nonbinding and creates no offer, order, invoice,
payment, reservation or VM.

Money is represented as strings with four fractional digits. Intermediate
calculations use scaled `bigint` arithmetic. Hourly uses 24 periods per rental
day; daily uses one period per day; monthly uses the version's monthly rate and
requires whole fixed 30-day periods. Partial monthly periods are rejected,
not silently prorated. Template rule minimums are applied as a deterministic
floor adjustment.

## Negotiation policy administration

| Method | Route | Access |
| --- | --- | --- |
| GET | `/provider/negotiation-policies?organizationId=...` | Provider member |
| GET | `/provider/negotiation-policies/:id?organizationId=...` | Provider member |
| POST | `/provider/negotiation-policies` | Provider administrator |
| PATCH | `/provider/negotiation-policies/:id?organizationId=...` | Provider administrator, inactive only |
| POST | `/provider/negotiation-policies/:id/activate?organizationId=...` | Provider administrator |
| POST | `/provider/negotiation-policies/:id/deactivate?organizationId=...` | Provider administrator |
| POST | `/provider/negotiation-policies/evaluate` | Provider member |

Policies validate a 0–100 maximum discount, nonnegative minimum and approval
prices, 1–50 attempts, and a valid effective window. Activation/deactivation
uses a per-organization transaction advisory lock and closes an overlapping
active window. Active policy rows cannot be edited; create a new policy for a
commercial change. Evaluation enforces the smaller of the organization and
pricing-rule discount ceilings, the larger of the organization and rule price
floors, and reports whether the proposed price requires approval below the
configured threshold. The policy minimum is interpreted in the supplied
pricing-version currency; no currency conversion is attempted.

## Errors

Validation errors are `400`, missing sessions are `401`, role or membership
failures are `403`, missing scoped records are `404`, commercial/state and
duplicate conflicts are `409`, and unexpected database failures are returned
through the existing generic `500` envelope. DTO whitelist validation rejects
unknown fields, including client-supplied actor, price, discount or ownership
fields.
