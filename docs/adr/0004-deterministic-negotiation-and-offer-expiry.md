# ADR 0004: deterministic negotiation and immutable offer proposals

## Decision

Negotiation is a backend service separate from the AI/chat adapter. It reuses
the CP-04 exact-money quote path, resolves the effective pricing version and
policy in the offer transaction, and stores a complete commercial snapshot.
Customer requests are untrusted inputs. Prices, discounts, expiry, provider
review and status are server decisions.

The existing `chat_sessions.id` is the negotiation aggregate identifier. A new
`negotiation_attempts` table records durable, session-scoped attempts and
outcomes. `offers.parent_offer_id` records normalized counteroffer lineage;
`commercial_snapshot` preserves the policy summary and pricing-rule IDs used
for the decision. A partial unique index permits only one actionable offer per
chat session.

Provider-review queue membership is represented by the offer's
`pending_provider_review` status. `offer_approvals` requires a reviewer, so a
pending row is not fabricated before a real provider decision; approved and
rejected decisions create the durable approval record with the actual reviewer.

## Consequences

The active pricing/policy records remain historical references and later
changes do not rewrite offers. Counters supersede the prior actionable offer
inside one transaction. `idempotency_keys` protects retries by actor and
aggregate. Expiry is both a hard eligibility guard and a worker reconciliation
job. The offer-to-order acceptance boundary remains reserved for CP-06.
