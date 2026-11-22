# CloudPilot backend submission backlog

## Purpose

This backlog covers the requested submission: a complete NestJS backend connected to PostgreSQL, a reproducible source ZIP, a Jira board showing ownership, and GitHub contribution evidence from both members.

It is based on the architecture, requirements register, diagrams, roadmap, and the first-demo workflow. The scope covers the semester simulation only. It excludes real cloud provisioning and real payment settlement. Use `docs/repository-structure.md` as the canonical code and documentation path map.

## Current baseline

The repository already has a NestJS server, PostgreSQL connection check, Docker Compose, environment example, and a React entry screen. It does not yet contain database schema migrations, domain modules, API contracts, authentication, business workflow implementation, automated tests, seed data, or a final backend ZIP.

## Jira workflow

Create one Jira board called `CloudPilot Backend Delivery`. Use these statuses:

`Backlog` → `Ready` → `In progress` → `Code review` → `QA` → `Done`

Create the two components `Business and accounting` and `Platform and infrastructure`. Give every issue the `backend-submission` label, a linked requirement or workflow reference, acceptance criteria, and verification evidence before moving it to Done.

## Member allocation

The two long-lived Git branches are `Shadan` and `Ayan`, with nine issues each. The agreed task order starts Ayan on NestJS foundations and Shadan on the Jira board. Each owner completes the issue and requests review from the other member before it enters QA.

| Step | Owner branch | Key | Jira issue | Code and document location | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Ayan | CP-10 | Configure NestJS platform foundations and backend quality controls | `apps/api/src/common/`, `apps/api/src/config/`, `apps/api/src/health/` | Validated configuration, API versioning, DTO validation, standard errors, request logging, CORS, health checks |
| 2 | Ayan | CP-02 | Design PostgreSQL schema, migrations, indexes, and demo seed data | `database/migrations/`, `database/seeds/`, `docs/database/` | Versioned migrations create the schema, reset/seed commands work, ERD matches the database |
| 3 | Ayan | CP-03 | Implement account, role, profile, and onboarding persistence | `apps/api/src/modules/identity/`, `apps/api/src/modules/onboarding/` | Customer/provider roles, PostgreSQL cookie sessions, bcrypt-compatible password hashing, account state, resumable onboarding, CSRF and ownership foundations |
| 4 | Ayan | CP-04 | Implement provider VM catalog, capacity, pricing, and negotiation policy administration | `apps/api/src/modules/catalog/`, `apps/api/src/modules/pricing/` | Provider-only CRUD, versioned prices, policy validation, audit records, deterministic quote checks |
| 5 | Ayan | CP-05 | Implement deterministic negotiation and immutable offer lifecycle | `apps/api/src/modules/negotiation/`, `apps/api/src/modules/offers/` | Offers, counteroffers, expiry, price snapshots, discount limits, durable attempts/lineage, provider review and CP-06 acceptance eligibility contract |
| 6 | Ayan | CP-06 | Implement order acceptance, invoice issuance, and simulated-payment verification | `apps/api/src/modules/orders/`, `apps/api/src/modules/billing/`, `apps/api/src/modules/payments/` | Explicit acceptance, one invoice per offer, amount/status validation, idempotent confirmation |
| 7 | Ayan | CP-07 | Implement usage-ledger billing and invoices | `apps/api/src/modules/usage/`, `apps/api/src/modules/billing/` | Rate snapshots, invoice items, correct balances/status, repeat-job protection, overdue rules |
| 8 | Ayan | CP-08 | Implement provider review, pricing history, and commercial reporting endpoints | `apps/api/src/modules/provider/`, `apps/api/src/modules/analytics/` | Scoped provider views, justified overrides, pagination, auditable revenue and invoice summaries |
| 9 | Ayan | CP-09 | Prepare the business-domain API reference and database handoff | `docs/api/`, `docs/database/` | OpenAPI/endpoints, schema dictionary, seed guide, request examples, peer review |
| 1 | Shadan | CP-01 | Create the Jira backlog, issue links, workflow, and requirements traceability matrix | Jira board and `supporting-documents/planning/CloudPilot-Backend-Submission-Backlog.md` | Board URL, all issues assigned and linked to requirements or architecture sources |
| 2 | Shadan | CP-11 | Implement persisted AI-chat sessions and a controlled AI adapter | `apps/api/src/modules/chat/` | Requirement schema, saved conversations/messages, timeout/fallback, AI cannot set prices or provision directly |
| 3 | Shadan | CP-12 | Implement provisioning jobs, worker, and simulated VM provider | `apps/api/src/worker/`, `apps/api/src/modules/provisioning/` | Durable jobs, safe retries, simulator adapter, capacity check, progress stages |
| 4 | Shadan | CP-13 | Implement VM lifecycle, ownership, and usage generation | `apps/api/src/modules/vms/`, `apps/api/src/modules/usage/` | Start/stop/restart/terminate, valid transitions, unique simulated identifiers, reproducible metrics |
| 5 | Shadan | CP-14 | Implement upgrades, downgrades, and resize jobs | `apps/api/src/modules/upgrades/`, `apps/api/src/modules/vms/` | Approval, configuration checks, price changes, rollback/retry behavior, storage safety |
| 6 | Shadan | CP-15 | Implement notifications, support tickets, and immutable audit logging | `apps/api/src/modules/notifications/`, `apps/api/src/modules/support/`, `apps/api/src/modules/audit/` | In-app notices, owned ticket access, audit of business/VM actions, scoped visibility |
| 7 | Shadan | CP-16 | Build backend integration, concurrency, security, and recovery tests | `apps/api/test/unit/`, `apps/api/test/integration/`, `apps/api/test/e2e/` | Duplicate prevention, IDOR checks, worker recovery, payment lock checks |
| 8 | Shadan | CP-17 | Complete Docker, GitHub Actions, database recovery, and API smoke verification | `Dockerfile`, `compose.yaml`, `.github/workflows/`, `scripts/`, `docs/runbooks/` | One-command startup, reset/seed, CI build/tests, health checks |
| 9 | Shadan | CP-18 | Produce the final backend submission package and evidence record | `artifacts/submissions/`, `docs/runbooks/` | Source ZIP, SHA-256, run steps, test output, Jira/GitHub links, access evidence |

## Required integration checkpoints

These checkpoints should be Jira sub-tasks linked to both workstreams.

1. Agree the data model and migrations before CP-03, CP-04, CP-06, CP-12, or CP-15 begin.
2. Freeze API request and response contracts before frontend integration.
3. Run the complete first-demo workflow with seed accounts after CP-06 and CP-12 are integrated.
4. Run security and duplicate-submission tests before CP-18.
5. Package the repository only after the database can be recreated from migrations and seed data.

## Daily GitHub contribution rule

Each member should use their own GitHub account and make one meaningful daily contribution while assigned work is active. A meaningful contribution can be a commit, reviewed pull request, test improvement, migration, documentation update, or verified bug fix. Every pull request should reference its Jira issue key and include test evidence.

Shadan pushes only to `Shadan`; Ayan pushes only to `Ayan`. Open pull requests from those branches to `main`, and merge only after review and checks pass. After `main` changes, merge its latest commit into the member branch before continuing. Keep `main` runnable. Do not commit `.env`, passwords, database dumps containing credentials, or `node_modules`.

## Submission checklist

- [ ] GitHub repository has both members as contributors and the instructor as collaborator.
- [ ] Jira board has both members and the instructor with access, assigned issues, issue history, and board URL.
- [ ] PostgreSQL schema is recreated by migrations and populated by documented seed data.
- [ ] API connects to PostgreSQL and exposes a verified database health response.
- [ ] Backend includes authentication, catalog/pricing, controlled chat, offers, order/payment gate, provisioning simulation, VM lifecycle, usage, billing, audit, notifications, and support.
- [ ] Repeated acceptance, payment confirmation, invoice generation, and provisioning attempts cannot create duplicates.
- [ ] Automated unit, integration, security, and workflow tests pass.
- [ ] Docker Compose starts API, worker, and PostgreSQL from a clean machine.
- [ ] ZIP contains source, migrations, seed data, tests, Compose configuration, `.env.example`, API documentation, README, and a verification report. It excludes `.env`, `node_modules`, build output, and local database volumes.
- [ ] The ZIP filename uses `CloudPilot-backend-YYYY-MM-DD.zip` and includes a SHA-256 checksum file.
- [ ] Submission notes include the GitHub repository URL and Jira board URL.

## Important delivery note

A connected database must be reproducible from the submitted source. The ZIP should provide migrations and seed data rather than a copied live PostgreSQL data directory. This allows the marker to start the database safely with the documented configuration.
