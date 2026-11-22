# ADR 0003: PostgreSQL cookie sessions and session-bound CSRF

## Decision

CloudPilot uses opaque, 32-byte random browser session tokens. The raw token is
sent only in an HttpOnly cookie and only its SHA-256 digest is stored in
`sessions.token_hash`. Sessions have a configurable absolute lifetime (default
seven days), an idle lifetime (default one day), revocation, and throttled
`last_seen_at` updates. Account status is checked during every session lookup.

Passwords use bcrypt via `bcryptjs`, which verifies the `$2a$` hashes generated
by the Phase 1 PostgreSQL seed and hashes new passwords with the configured
work factor.

State-changing requests carrying the session cookie must provide an
Origin/Referer matching `CORS_ORIGIN`, plus `X-CSRF-Token`. The token is an
HMAC of the raw session token with `CSRF_SECRET` and is exposed only through a
separate non-HttpOnly `cloudpilot_csrf` cookie. The authentication cookie is
never readable by browser JavaScript.

## Rationale and boundaries

This matches the existing PostgreSQL `sessions` table and avoids introducing
JWT refresh-token state or an unapproved queue/ORM. CORS credentials remain
restricted to configured origins. The current rate limiter is intentionally
in-process and bounded; it is suitable for the single-instance demo and must
be replaced with shared durable storage before multi-instance deployment.

Email delivery is an injectable boundary. Development uses an in-memory capture
adapter for tests, never returns raw tokens over HTTP, and production startup
requires a future real delivery adapter rather than pretending that email was
sent.
