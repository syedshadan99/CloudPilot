# CloudPilot first-demo workflow

1. The customer signs up and completes onboarding.
2. The customer describes the VM they need in AI-assisted chat. The backend calculates an offer using the provider's rules.
3. The customer explicitly accepts the offer. CloudPilot records the acceptance and issues an invoice for the agreed terms.
4. The customer makes a simulated payment inside CloudPilot. The backend checks that the payment applies to the invoice and covers the amount due in the invoice currency.
5. Verified payment makes the order eligible for simulated provisioning. CloudPilot grants the customer access when the simulated VM is ready.

## Access and retries

- A pending, failed, or insufficient payment keeps provisioning and resource access locked. A VM that is still provisioning or has failed to provision also stays locked.
- Offer acceptance, invoice issuance, payment verification, and VM readiness are distinct events. The backend owns the recorded state and enforces each transition.
- Repeating the same confirmation returns the existing result for that action. Repeating offer acceptance reuses its invoice, repeating payment confirmation reuses the payment record, and retrying provisioning for the same paid order reuses its VM allocation. Later implementation must enforce these rules under concurrent requests.

This flow is the reference for later features. Phase 1 provides the React, NestJS, and PostgreSQL foundation.
