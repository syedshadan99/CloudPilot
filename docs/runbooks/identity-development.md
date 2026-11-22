# Identity development runbook

## Local setup

1. Copy `.env.example` to `.env` and set local PostgreSQL credentials.
2. Start PostgreSQL with `docker compose up db` when Docker is available.
3. Apply migrations and demo data:

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

4. Build and start the API:

   ```powershell
   npm run build --workspace @cloudpilot/api
   npm run start --workspace @cloudpilot/api
   ```

The health probes are `/health` and `/health/db`; identity routes are under
`/api/v1`.

## Demo credentials and email capture

The development seed contains three synthetic accounts. Their password is the
demo-only phrase documented in the seed file; it must not be reused in a real
environment. The Node verifier is tested against the PostgreSQL-compatible
`$2a$` format. Development email capture keeps the latest raw token in the
injected adapter's process memory for automated tests only. Tokens are never
returned in HTTP responses or logged.

Set `EMAIL_DELIVERY_MODE=disabled` only when deliberately testing the missing
delivery boundary. Production configuration rejects the development CSRF
secret, insecure session cookies, and capture-mode email delivery.

## Verification commands

```powershell
npm run build --workspace @cloudpilot/api
npm run test:unit
npm run test:database
```

Database-backed tests require a disposable migrated/seeded PostgreSQL instance.
Do not run reset commands against a shared database. The current environment
must have Docker or PostgreSQL running before the database test command can
pass.

## Future integration contract

Later modules must use `AuthenticatedPrincipal.userId`, never a request body or
query-string customer ID, and must apply ownership filters in repositories.
Provider routes should declare `@Roles("provider_admin")` or the narrower role
set they require. Organization access must call the exported
`AuthorizationService` membership check; organization-local roles do not grant
global provider roles. Account status is checked by session validation and
domain services.

Real email delivery, durable multi-instance throttling, advanced organization
administration, email-change verification, account deletion/anonymization, and
full audit event wiring remain later integration work.
