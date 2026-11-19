# CloudPilot repository structure

This guide is the source of truth for where current and planned files belong. Planned feature directories are reserved with a `.gitkeep` marker until real source files are added. Do not duplicate supplied academic documents.

```text
CloudPilot/
├── apps/
│   ├── web/
│   │   ├── public/                         Static browser assets
│   │   └── src/
│   │       ├── App.tsx                     Root UI composition
│   │       ├── main.tsx                    Browser entry point
│   │       ├── features/                   Feature-specific screens and state
│   │       ├── components/                 Shared product UI components
│   │       ├── layouts/                    Public, customer, and provider shells
│   │       ├── design-system/              Existing CSS tokens, themes, typography
│   │       ├── lib/api/                    HTTP client and API error handling
│   │       ├── hooks/                      Shared React hooks
│   │       ├── assets/                     Imported product assets
│   │       └── test/                       Frontend unit and browser tests
│   └── api/
│       ├── src/
│       │   ├── main.ts                     HTTP API entry point
│       │   ├── app.module.ts               Root NestJS module
│       │   ├── common/                     Shared guards, filters, pipes, interceptors
│       │   ├── config/                     Validated application configuration
│       │   ├── database/                   PostgreSQL pool and runtime connection
│       │   ├── health/                     API and database health endpoints
│       │   ├── modules/                    Business domains listed below
│       │   └── worker/                     Background worker entry point and setup
│       └── test/
│           ├── unit/                       Isolated domain behavior
│           ├── integration/                PostgreSQL-backed module behavior
│           └── e2e/                        HTTP and first-demo workflows
├── database/
│   ├── migrations/                         Versioned PostgreSQL schema changes
│   └── seeds/                              Reproducible local/demo seed data
├── docs/
│   ├── adr/                                Accepted engineering decisions
│   ├── api/                                OpenAPI and endpoint documentation
│   ├── database/                           Implemented schema reference and ERD
│   └── runbooks/                           Setup, reset, recovery, release steps
├── supporting-documents/
│   ├── academic/                           Submitted academic documents
│   ├── planning/                           Supplied plans and project backlogs
│   └── diagrams/                           Supplied academic and system diagrams
├── scripts/                                Repeatable local developer commands
├── .github/workflows/                      Build and verification automation
├── artifacts/submissions/                 Generated ZIP and checksum, ignored by Git
├── compose.yaml                            Local web, API, and PostgreSQL services
├── Dockerfile                              Container build stages
├── .env.example                            Placeholder local settings
├── package.json                            npm workspace definitions and scripts
└── package-lock.json                       The single dependency lockfile
```

## API module ownership

Under `apps/api/src/modules/`, create a folder for each implemented domain:

- `identity` owns registration, password hashing, login, sessions, roles, profiles, and account status.
- `onboarding` owns saved onboarding progress and completion.
- `catalog` owns VM templates and simulated capacity.
- `pricing` owns versioned rates and provider pricing policy.
- `chat` owns conversations, messages, requirement extraction, and the replaceable AI adapter.
- `negotiation` and `offers` own deterministic price calculation, offer states, counters, expiry, and acceptance eligibility.
- `orders` owns confirmed order state and the transition into invoice/payment eligibility.
- `payments` owns internal simulated payment recording and backend verification.
- `provisioning` owns durable provisioning jobs and the simulated provider adapter.
- `upgrades` owns approved resize and configuration-change workflows.
- `vms` owns resource state and permitted lifecycle actions.
- `usage` owns reproducible usage events and meter records.
- `billing` owns charge ledgers, invoices, invoice items, and balances.
- `provider` and `analytics` own provider operations, deal review, and record-backed summaries.
- `notifications`, `support`, and `audit` own their persisted records and access rules.

An implemented module should contain only files it needs. A typical shape is `<domain>.module.ts`, `<domain>.controller.ts`, `<domain>.service.ts`, `dto/`, `repositories/`, and domain-specific `jobs/`. Keep SQL migrations in the root `database/migrations/` and seed data in `database/seeds/`; keep runtime PostgreSQL connection code in `apps/api/src/database/`. No ORM or external payment gateway is assumed.

## Placement rules

- Keep a domain rule and its data-access code in that domain's module. Put genuinely cross-domain infrastructure in `common/` or `database/`.
- Keep feature-only web code in `src/features/<feature>/`. Use `components/` only for UI reused across features.
- The worker is another entry point in `apps/api`, not a new microservice. Its startup belongs in `src/worker/`; a job handler belongs beside its owning API domain.
- Keep the root Compose and Docker files at the repository root so the documented `docker compose` commands work unchanged.
- Keep supplied academic documents, planning references, and diagrams in their existing `supporting-documents/` folders. Put implementation API specs, database references, architecture decisions, and runbooks under `docs/`.
- Put generated builds in `apps/*/dist/`, coverage in `coverage/`, and the handoff ZIP and SHA-256 file in `artifacts/submissions/`. Do not commit these outputs, secrets, `.env`, database data directories, or `node_modules/`.
- Add a shared `packages/` workspace only if a concrete cross-app contract or utility is accepted and used by both applications.
