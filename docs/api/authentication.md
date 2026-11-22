# Identity and onboarding API

The API uses the global prefix and URI versioning configured by NestJS. Routes
below are therefore under `/api/v1` (health probes remain version-neutral).

## Session and browser rules

Successful login sets an HttpOnly session cookie (default
`cloudpilot_session`) and a separate `cloudpilot_csrf` cookie. The session
cookie is `Secure` when `SESSION_COOKIE_SECURE=true`, uses configured
SameSite behavior (default `lax`), has path `/`, and expires server-side after
the absolute or idle lifetime. Never copy the session cookie into an
Authorization header or URL.

For authenticated `POST`, `PATCH`, `PUT` and `DELETE` requests, send the value
of `cloudpilot_csrf` as `X-CSRF-Token` and send an allowed `Origin`. Public
registration, login, verification and recovery requests do not need a session
CSRF token. CORS credentials are allowed only for `CORS_ORIGIN`.

## Authentication endpoints

| Method and route | Auth | Behavior |
| --- | --- | --- |
| `POST /auth/register` | Public | Creates a customer in `pending_verification`, profile and onboarding row, then queues a verification message. |
| `POST /auth/login` | Public | Verifies bcrypt password and active account, persists a session, and sets cookies. |
| `GET /auth/me` | Session | Returns the current sanitized account and customer profile. |
| `POST /auth/logout` | Public/idempotent | Revokes the supplied session when present and clears cookies. |
| `POST /auth/logout-all` | Session | Revokes every session for the current account. |
| `POST /auth/verify-email` | Token | Atomically consumes a verification token and activates a pending account. |
| `POST /auth/resend-verification` | Public/throttled | Generic response; only pending accounts receive a new token. |
| `POST /auth/forgot-password` | Public/throttled | Generic response; eligible accounts receive a reset token. |
| `POST /auth/reset-password` | Token | Atomically consumes a reset token, updates bcrypt password, and revokes all sessions. |

### Register request

```json
{
  "fullName": "Ayan Hamdani",
  "email": "ayan@example.com",
  "password": "at-least-12-characters",
  "companyName": "Example Studio",
  "workloadType": "web hosting",
  "preferredCurrency": "USD",
  "termsAccepted": true
}
```

The server always assigns `customer`, `pending_verification`, and the current
terms timestamp. Role, status, verified state, IDs, and organization
membership are not accepted fields. Unknown fields are rejected.

### Login response

```json
{
  "user": {
    "id": "uuid",
    "fullName": "Ayan Hamdani",
    "email": "ayan@example.com",
    "role": "customer",
    "status": "active",
    "emailVerifiedAt": "2026-11-22T10:00:00.000Z",
    "termsAcceptedAt": "2026-11-22T09:59:00.000Z",
    "createdAt": "2026-11-22T09:59:00.000Z"
  },
  "session": { "expiresAt": "2026-11-29T10:00:00.000Z" }
}
```

Passwords, password hashes, session hashes, reset tokens, verification tokens,
and internal security metadata never appear in responses.

## Profiles

`GET /users/me` and `PATCH /users/me` require a session. PATCH accepts only
`fullName`, `companyName`, `workloadType`, `billingEmail`,
`preferredCurrency`, and `timezone`. Email, role, status, terms acceptance,
organization ownership, and verification state require separate future
workflows and are rejected as unknown or unsupported fields.

## Onboarding

`GET /onboarding`, `PATCH /onboarding`, and `POST /onboarding/complete` require
an active customer session. Persisted steps are `welcome`, `workload`,
`duration`, `billing`, `expertise`, `recommendation`, and `complete`.
Informational explanation/example UI screens do not add database enum values.

PATCH accepts partial fields `currentStep`, `workloadType`, `durationDays`,
`billingCycle`, `technicalLevel`, `preferredCurrency`, and `skip`. Responses
are stored only from this allowlist. The server rejects jumps over a persisted
step, direct `complete`, unbounded JSON, and client-supplied completion times.
Completion requires workload, positive bounded duration, billing cycle, and
technical level. Repeated completion returns the completed record.

## Errors and throttles

Validation failures are `400`; missing/invalid sessions are `401`; insufficient
roles, invalid CSRF or account restrictions are `403`; duplicate registration
is `409`; invalid/expired single-use credentials are `409`; throttled actions
are `429`. Login failures use a generic `401` for unknown email and wrong
password. Recovery and resend responses do not reveal account existence.

The current login, registration, resend and recovery limits are bounded
in-process limits documented as single-instance demo behavior. They are not
restart-safe or multi-instance-safe.
