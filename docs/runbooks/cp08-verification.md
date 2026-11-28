# CP-08 verification runbook

Use a disposable local database. Do not print or commit `.env` values.

```powershell
# From the repository root
docker compose up -d db
Copy-Item .env.example .env -ErrorAction SilentlyContinue

# Load only the database variables into this PowerShell process.
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*(PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD)\s*=\s*(.*)\s*$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"'), 'Process')
  }
}

docker compose ps
npm run db:migrate
npm run db:status
npm run db:seed
npm run test:phase7
npm run test:database
npm run test:unit
npm run build
docker compose config --quiet
git diff --check
```

Start the API in a separate terminal with the same environment and run the existing cookie-session login flow. Obtain a CSRF token from the existing auth endpoint before any POST. Then call, using the real organization UUID from the login/demo data:

```powershell
curl.exe -i -b $cookieJar -c $cookieJar "http://127.0.0.1:3000/api/v1/provider/dashboard?organizationId=$organizationId"
curl.exe -i -b $cookieJar "http://127.0.0.1:3000/api/v1/provider/customers?organizationId=$organizationId&page=1&pageSize=25"
curl.exe -i -b $cookieJar "http://127.0.0.1:3000/api/v1/provider/deals?organizationId=$organizationId&status=pending_provider_review"
curl.exe -i -b $cookieJar "http://127.0.0.1:3000/api/v1/provider/pricing/history?organizationId=$organizationId"
curl.exe -i -b $cookieJar "http://127.0.0.1:3000/api/v1/provider/analytics/revenue?organizationId=$organizationId"
curl.exe -i -b $cookieJar "http://127.0.0.1:3000/api/v1/provider/analytics/deals?organizationId=$organizationId"
curl.exe -i -b $cookieJar "http://127.0.0.1:3000/api/v1/provider/analytics/vms?organizationId=$organizationId"
curl.exe -i -b $cookieJar "http://127.0.0.1:3000/api/v1/provider/analytics/billing?organizationId=$organizationId"
curl.exe -i -b $cookieJar "http://127.0.0.1:3000/api/v1/provider/activity?organizationId=$organizationId&page=1&pageSize=25"
```

For isolation, log in as a second provider organization and change only `organizationId` and object IDs. Verify another organization's dashboard is `403`, and its deal/customer/pricing/order/VM/invoice IDs are `404` or otherwise denied. Also verify an authenticated customer receives `403` for provider routes and a provider staff user receives `403` for the override route.

For an eligible pending deal, submit a JSON body containing a policy-valid `discountPercent` and mandatory `reason` with an `Idempotency-Key`. Repeat the exact request and confirm the same revised offer is returned. Reuse the key with a different discount and confirm `409`. Confirm the source offer is `countered`, the revised offer is `presented`, an audit event contains previous/new values, no order/invoice changed, and customer acceptance is still required.

To compare KPIs with PostgreSQL, use read-only queries such as:

```sql
SELECT count(DISTINCT customer_id) FROM offers WHERE organization_id = '<org>';
SELECT currency, sum(total), sum(amount_paid)
FROM invoices i JOIN orders o ON o.id = i.order_id
WHERE o.organization_id = '<org>' GROUP BY currency;
SELECT state, count(*) FROM virtual_machines vm JOIN orders o ON o.id = vm.order_id
WHERE o.organization_id = '<org>' GROUP BY state;
```

`activeVirtualMachines` is the `RUNNING` row from the VM query, not the sum of every non-terminal state. For recurring invoice reconciliation, use `invoice_items.charge_ledger_id -> charge_ledger_entries.vm_id -> virtual_machines.order_id -> orders.organization_id`; do not sum invoice headers after joining invoice items or payment attempts. Shared recurring invoice payments remain unallocated because payment-allocation rows are not persisted.

Record exact passed/failed/skipped counts. A skipped or unavailable live database run is a blocker, not a pass. Finish with `git status --short --branch` and `git diff --check`.
