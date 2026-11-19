# CLOUD PILOT — MASTER DEVELOPMENT & IMPLEMENTATION ROADMAP

**Version:** 1.0 | **Date:** 10 November 2026 | **Status:** Proposed implementation baseline  
**Product:** CloudPilot — AI-Powered Cloud Negotiation and Provisioning Portal  
**Tagline:** Negotiate. Provision. Scale.

## 0. Authority, scope, and traceability

**Authoritative inputs, in priority order:**
1. The user's latest explicitly finalized technology stack: React + TypeScript/JSX/CSS; NestJS on Node.js; PostgreSQL; Docker; GitHub; cloud deployment.
2. The supplied UI design: `app_colors.dart`, `app_sizes.dart`, and `app_theme.dart`, translated faithfully to the web. These are **Flutter theme specifications, not runnable React components**.
3. The supplied `CloudPilot-Architecture.md` as the product and functional scope source.
4. The previously completed software-engineering design diagrams (UCD, ERD, domain model, class, activity and sequence diagrams). The actual final diagrams were **not uploaded in this turn**, so entity cardinalities, precise transitions, and diagram-specific decisions must be verified against that design pack before their corresponding implementation is finalized.

**Superseded architecture recommendations:** Next.js App Router, Next.js route handlers, Server Actions, Tailwind and the deep-navy/electric-cyan proposed palette. Use **React SPA + NestJS REST API** and the supplied **forest-green/sage/terracotta** UI design instead. No Flutter runtime is included in the web product.

**Product boundary:** Semester release uses **simulated** VMs, console, metering and payment recording; not actual cloud VM provisioning, bank settlement, real SSH or production hypervisor management. Design replaceable interfaces for future integration. Provider staff, full multi-organization support, promotional campaigns, payment sandbox and real-time advanced facilities are optional later stages. Source architecture sections 3, 20 and 25.

**Success condition:** A complete live demonstration of registration → onboarding → AI requirements → policy-compliant offer → explicit confirmation → order → simulated provisioning → VM control → usage → billing/invoice → upgrade → provider review/administration → audit.

## 1. Engineering principles (non-negotiable)

1. Backend authority: all prices, role permissions, resource availability, offers, orders, VM transitions and billing totals validated server-side.
2. AI is an assistant, **never** the system of record or authoritative transaction executor.
3. Offer and order are separate aggregates; confirmation is explicit, authenticated, atomic and idempotent.
4. Pricing and policy versions are retained as accepted-order snapshots, preserving invoice history.
5. VM infrastructure is an adapter (`VirtualMachineProvider`) with `SimulatedVMProvider` initially.
6. Bills derive from immutable metering and VM lifecycle events; no client-originated totals.
7. Customer data is tenant/owner scoped; every protected operation enforces server-side authorization.
8. UI colors, typography, spacing, radii and component styles come from shared tokens, not ad hoc values.
9. Build vertical slices with working data flows, not an accumulation of disconnected visual mockups.
10. Each phase is complete only after review, tests, documentation, accessibility, responsive checks and a Git commit/PR.

## 2. Final technology baseline and recommendations

### Mandatory technology
- Frontend: React, TypeScript, TSX (React's JSX syntax) and CSS.
- Backend: NestJS + TypeScript, Node.js runtime.
- Data: PostgreSQL relational database.
- Ops: Docker, Docker Compose for local development, Git + GitHub, cloud deployment.

### Proposed implementation libraries (choices, **not** already finalized by the user)
- React development/build: **Vite**.
- Routing: **React Router**.
- Server data/cache: **TanStack Query**.
- Forms: **React Hook Form + Zod** or an equivalently validated form layer.
- CSS: plain modular CSS (`*.module.css`) + global CSS custom-property design tokens; optional no theme framework.
- Graphs: **Recharts** or other accessible React charting library.
- Backend API: NestJS REST controllers, OpenAPI/Swagger documentation, class-validator/DTO validation.
- Persistence: **Prisma** + PostgreSQL migrations (or TypeORM if final design imposes it); select one ORM and use it consistently.
- Authentication: authenticated, expiring, HttpOnly secure cookie session (session storage implementation to be decided) with CSRF defenses where applicable; backend roles/ownership checks; recovery and verification tokens stored hashed.
- Background tasks: a separate NestJS worker, PostgreSQL-backed durable job/outbox records and a scheduler. Avoid a Redis requirement initially; move to a proven Redis-backed queue if throughput or operations later require it.
- Testing: Vitest/React Testing Library, Jest or Nest test runner + Supertest, Playwright E2E, isolated PostgreSQL integration tests.
- Code quality: ESLint, Prettier, TypeScript strict mode, GitHub Actions.
- AI: provider selected/configured later behind `AiProvider` interface; structured/validated outputs only. Provide deterministic mock/fallback mode for demos and tests.

**Versioning rule:** Select mutually compatible, supported stable versions at repository initialization, record exact versions/lockfile, and do not mix incompatible setup tutorials. Specific version numbers are not asserted here.

## 3. Target architecture and boundaries

```text
Browser (public / customer / provider)
  React + TSX + CSS tokens
      |
      | HTTPS JSON; optional SSE for progressive AI/provisioning status
      v
  NestJS API (validation, sessions, RBAC + ownership guards)
      |
      +-- Auth / Accounts / Onboarding
      +-- Catalog / Pricing / Policy
      +-- Conversations / AI adapter / Negotiation
      +-- Offers / Orders / Provisioning
      +-- VMs / Usage / Billing / Invoices
      +-- Customer / Provider / Analytics
      +-- Notifications / Support / Audit
      |
      +---- PostgreSQL (migrations, state, events, invoices)
      +---- AI provider API (server credentials only)
      +---- Durable workers/outbox (expiry, provisioning, metering, billing)
      +---- SimulatedVMProvider (replaceable adapter)
```

**Recommended deployment topology:** static React build hosted on a CDN/static hosting service; NestJS API as container; NestJS worker as a separate container/service; managed PostgreSQL with TLS and backups. Use HTTPS and a consistent cookie/auth domain policy. Only the API has database credentials. Never run the DB as a disposable production container unless backups, persistence and operations are explicitly supported.

### Canonical request path
React component → typed API client → NestJS DTO and authentication/authorization guard → domain service → repository/transaction → PostgreSQL → serialized response → React Query cache/state update.

### Asynchronous path
Domain transaction → durable outbox/job → worker → bounded retries and idempotent step → state/event insert → notification and API status refresh. Provide reconciliation for jobs interrupted by worker restarts.

### Contract conventions
- Version API under `/api/v1`.
- Prefer REST with consistent error payloads (code, message, detail, requestId) and pagination/filter/sort contracts.
- Validate input at DTO boundary and recheck domain invariants within services.
- Unique client request/idempotency key for acceptance, provisioning requests, billing cycle issuance and other non-repeatable actions.
- Use UTC timestamps in DB and localize for UI; use fixed decimal arithmetic / integer minor currency units for prices; avoid floating-point currency arithmetic.
- Document all public endpoints, sample payloads, authorization policies and failure cases in OpenAPI.

## 4. Design system: faithful Flutter → web conversion

The supplied files define **both light and dark modes**, using Inter typography and a Material-3-inspired component palette. On the web, reproduce the **values and visual intent**, not Flutter widgets or imports. A Material UI component library is not required. The architecture document's *suggested* navy/cyan theme is superseded.

### 4.1 Color source of truth (`app_colors.dart`)

| Token | Exact source value | Web use |
|---|---|---|
| primary | `#43632E` | Main brand, primary buttons, accents |
| primaryLight | `#3D6358` | Info / alternative deep-green accent |
| primaryLighter | `#4E7B6E` | Dark-mode primary |
| primaryMuted | `#8AAFA5` | Soft accent |
| primarySoft | `#BDD4CF` | Soft surface/accent |
| primaryPale | `#DEEAE7` | Pale accent background |
| secondary | `#8E9B82` | Sage accent / secondary controls |
| secondaryDark | `#4A5443` | Deep sage |
| secondaryMedium | `#6B7A60` | Mid sage |
| secondaryLight | `#ADB8A2` | Light sage |
| secondaryPale | `#CDD5C6` | Pale sage |
| secondaryPastel | `#E8EDE4` | Pastel sage |
| secondarySoft | `#298E9B82` | ARGB `0x29` = approx 16% alpha; CSS `#8E9B8229` |
| tertiary | `#D97B66` | Terracotta accent and warning |
| tertiaryDark | `#7A2E1E` | Deep terracotta and error |
| tertiaryMedium | `#B85A42` | Medium terracotta |
| tertiaryLight | `#E4A394` | Light terracotta |
| tertiaryPale | `#F0C8BF` | Pale terracotta |
| tertiaryPastel | `#F8E5E1` | Pastel terracotta |
| tertiarySoft | `#24D97B66` | ARGB `0x24` ≈14% alpha; CSS `#D97B6624` |
| neutral/background | `#F7F5F0` | Warm off-white page background |
| neutralDark | `#1A1A1A` | Primary dark text |
| neutralBorder | `#DDDAD4` | Divider/border |
| neutralSurface | `#F0EDE8` | Alternative light surface |
| cardBackground | `#F2EFE9` | Light cards |
| darkCard | `#222926` | Dark cards and dark surface |
| darkOnSurface | `#E8E4DE` | Light text on dark surfaces |
| mutedText | `#56635D` | Supporting text |
| border | `#E4E0D8` | Subtle border |
| searchBackground | `#EFECE6` | Search field |
| success | `#4A7C59` | Success / active |
| warning | `#D97B66` | Warning |
| error | `#7A2E1E` | Error |
| darkRed | `#991B1B` | Strong destructive state |
| info | `#3D6358` | Informational |
| iconButtonDelete | `#B94040` | Delete action |
| hero gradient | `#3A5728` → `#43632E` → `#5A7A3E` | Top-left to bottom-right |

Additional source constants to preserve: primary2 = primary, buttonPrimary/Secondary/Inverted, outlined foreground/border, dividerPrimary/Secondary/Tertiary, searchBorder/searchHint, scaffoldBackground and neutral gray scale.

### 4.2 Spatial and component constants (`app_sizes.dart`)

- Spacing scale (px, web CSS design units): `2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- Radii: `0, 4, 8, 12, 16, 20, 24, 999` px. Default 12; card 16; pills 999.
- Icon sizes: `12, 16, 20, 24, 28, 32` px; round icon buttons `36, 44, 52` px.
- Elevation *levels* from Dart: `0, 1, 2, 4, 8, 16`. Flutter elevation does not map exactly to CSS `box-shadow`, so define visually calibrated CSS shadow recipes and document them; do not claim pixel-exact conversion.
- Border widths: `1, 1.5, 2, 3` px; divider `1.5` or `2.5` px.
- Buttons: heights `32, 40, 48` px; horizontal padding `12, 16, 24` px; min-width `64, 88, 120` px.
- Inputs: 44px high, 16px horizontal padding, 10px vertical padding, 20px prefix icon, 1px border.
- Cards: 16px default padding, 24px large padding, 16px radius, 1px border.
- Transitions: 150, 250, 400, 600ms (`prefers-reduced-motion` must suppress non-essential motion).

### 4.3 Typography (`app_sizes.dart`)

**Font:** Inter throughout. Map Dart `fontSize`, `fontWeight`, `height` line-height ratio and `letterSpacing` to CSS as shown below.

| Role | Size | Weight | Line-height |
|---|---:|---:|---:|
| displayLarge | 57px | 400 | 1.12 |
| displayMedium | 45px | 400 | 1.16 |
| displaySmall | 36px | 400 | 1.22 |
| headlineLarge | 32px | 400 | 1.25 |
| headlineMedium | 28px | 400 | 1.29 |
| headlineSmall | 24px | 400 | 1.33 |
| titleLarge | 22px | 500 | 1.27 |
| titleMedium | 16px | 500 | 1.50 |
| titleSmall | 14px | 500 | 1.43 |
| bodyLarge | 16px | 400 | 1.50 |
| bodyMedium | 14px | 400 | 1.43 |
| bodySmall | 12px | 400 | 1.33 |
| labelLarge | 14px | 500 | 1.43 |
| labelMedium | 12px | 500 | 1.33 |
| labelSmall | 11px | 500 | 1.45 |
| button | 14px | 600 | 1.43 |

Keep role-specific letter spacing from Dart: displayLarge -0.25px; titleMedium 0.15px; titleSmall 0.1px; bodyLarge 0.5px; bodyMedium 0.25px; bodySmall 0.4px; labelLarge 0.1px; labelMedium/Small 0.5px; button 0.1px. Other tokens use default letter spacing.

### 4.4 Light/dark color mapping (`app_theme.dart`)

- Light: primary `#43632E`, secondary `#8E9B82`, tertiary `#D97B66`, error `#7A2E1E`, surface `#F2EFE9`, onSurface `#1A1A1A`.
- Dark: primary `#4E7B6E`, secondary `#8E9B82`, tertiary `#D97B66`, error `#7A2E1E`, surface `#222926`, onSurface `#E8E4DE`.
- Both: onPrimary `#F7F5F0`, onError `#F7F5F0`; onSecondary and onTertiary are `#F7F5F0` in light and `#1A1A1A` in dark, exactly per supplied mapping.
- **Source gap:** Dart theme does not explicitly specify the page-level dark background. Choose and document an accessible complementary dark background without altering the supplied exact surface/onSurface colors.
- **Source gap:** Source defines theme tokens, not the entire actual screen layouts. Screen layout/interaction specifics require design review in each phase.
- Verify text contrast in both modes; introduce minimally necessary accessible foreground variants where the original pairing fails accessibility, documenting rather than silently replacing source tokens.

### 4.5 Web implementation rules

- Create `tokens.css`, `themes.css`, `typography.css`, `global.css`, and reusable CSS-module components.
- Put light/dark selection on `html[data-theme]`, respect `prefers-color-scheme`, and persist user selection when implemented.
- Make common primitives: Button, IconButton, Input, Select, Checkbox, Radio, Switch, Card, Dialog, Drawer, Badge, Toast, Tooltip, Tabs, Stepper, Table, Skeleton, EmptyState and ErrorState.
- Every screen must use tokens; no independent page-specific brand shades.
- Responsive desktop/tablet/mobile designs, keyboard navigation, clear focus indicators, readable contrast, semantic HTML and reduced-motion support.
- Create a token-reference/checklist showing Dart → CSS correspondences; visual regression screenshots verify representative pages and themes.

### 4.6 Minimal CSS token example (implementation guidance, not full theme)

```css
:root {
  --color-primary: #43632e;
  --color-secondary: #8e9b82;
  --color-tertiary: #d97b66;
  --color-bg: #f7f5f0;
  --color-surface: #f2efe9;
  --color-text: #1a1a1a;
  --color-border: #dddad4;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --radius-card: 16px;
  --font-ui: 'Inter', system-ui, sans-serif;
  --duration-normal: 250ms;
}
html[data-theme='dark'] {
  --color-primary: #4e7b6e;
  --color-surface: #222926;
  --color-text: #e8e4de;
  /* Choose accessible page background as an explicit design decision. */
}
```

## 5. Repository and code organization

Use a **GitHub monorepo** with separate web and API workspaces. The complete path and ownership map is maintained in `docs/repository-structure.md` and summarized here so contributors create planned code in its agreed location.

```text
cloudpilot/
├── .github/workflows/               # build and verification automation
├── apps/
│   ├── web/
│   │   ├── public/
│   │   └── src/                      # features, components, layouts, design-system,
│   │                                   # lib/api, hooks, assets, and tests
│   └── api/                          # NestJS modular monolith
│       ├── src/
│       │   ├── common/               # shared guards, filters, pipes, interceptors
│       │   ├── config/               # validated application settings
│       │   ├── database/             # PostgreSQL pool, SQL migrations, seeds
│       │   ├── health/               # API and database checks
│       │   ├── modules/              # business domains
│       │   └── worker/               # worker entry point in the API workspace
│       └── test/{unit,integration,e2e}/
├── docs/                             # engineering API, database, ADRs, runbooks
├── supporting-documents/             # academic, planning, and supplied diagrams
├── scripts/                          # repeatable developer commands
├── artifacts/submissions/            # generated ZIPs, ignored by Git
├── Dockerfile
├── compose.yaml
├── .env.example
├── package.json                      # npm workspaces
└── package-lock.json                 # single repository lockfile
```

Use a NestJS modular monolith. Put business code in `apps/api/src/modules/<domain>/`, with each domain owning its controller, service, DTOs, repository, and jobs as needed. The worker is a separate NestJS entry point under `apps/api/src/worker/`, not a new application or microservice. Job handlers live beside their owning domain. Keep PostgreSQL runtime connection code in `apps/api/src/database/`, versioned SQL migrations in the repository-root `database/migrations/`, and seeds in `database/seeds/`. Keep academic material in its current `supporting-documents/` folders. Do not add an ORM or a third-party queue before the corresponding architecture decision is accepted.

### Branch policy
- Protect `main` and keep it runnable. Member Shadan pushes only to `Shadan`; member Ayan pushes only to `Ayan`.
- Open pull requests from a member branch into `main`. Require review and applicable build/test checks before merging.
- After `main` changes, merge the latest `main` into each member branch before continuing. Resolve conflicts with review, then rerun checks.
- Reference Jira issue keys in commits and pull requests. Tag demonstrable milestones (`v0.1`, `v0.2` ...).

## 6. Implementation phases and delivery gates

No hard calendar dates are assumed, because team size, pace, deadline and selected hosting are not specified. **Order is dependency-driven**, not a promise of duration. P0–P14 cover essential and strong academic scope; P15 covers advanced/optional scope.

| Phase | Name | Core output | Must pass before continuing |
|---|---|---|---|
| P0 | Architecture alignment | Decision register, traceability and scope | No unresolved architectural conflict blocks implementation |
| P1 | Workspace & CI | Running React, NestJS, PostgreSQL, Docker | Local one-command setup; CI baseline green |
| P2 | Design system | CSS tokens, themes, shared primitives | Source token parity; accessible desktop/mobile variants |
| P3 | Splash + public shell | Splash, logo, public layout and routes | Navigation, motion fallback and loading/failure states |
| P4 | Auth + onboarding | Registration, sessions, onboarding workflow | Role/owner checks, persist onboarding, E2E signup |
| P5 | Catalog + pricing policies | VM templates, rate versions, provider editors | Deterministic prices, versioned policy tests |
| P6 | AI chat + extraction | Chat persistence, requirement schema, AI adapter | Structured outputs validated, AI failure fallback |
| P7 | Negotiation + offers | Policy-aware discounts, offer review, expiry | Invalid deals blocked; stale offers rejected |
| P8 | Orders + provisioning | Atomic confirmation, simulation jobs, VM state | Idempotence, progress, failure/retry proven |
| P9 | VM operations + usage | VM console/control, state logs, usage simulation | Ownership, valid transitions, reproducible metrics |
| P10 | Billing + invoices | Metering, bill calculations, invoice records | Price snapshots, edge cases, duplicate protection |
| P11 | Upgrades + lifecycle | Resize/change requests and revised charges | Prior/current rates and rollback on failure |
| P12 | Dashboards + administration | Customer/provider dashboards, review and analytics | Cross-role permissions; grounded aggregates |
| P13 | Support + notifications + audit | Notifications, tickets, audit history | Delivery retry, traceability, scoped visibility |
| P14 | Hardening + deployment | Security/performance QA, backups, production demo | Full workflows and recovery pass in cloud |
| P15 | Optional extensions | Staff, multi-org, real email, sandbox payments | Independently scoped, cannot destabilize core |

### P0 — Architecture alignment and contract freeze
**Tasks:** compare architecture to finalized diagrams; map all 16 modules and workflows A–F; settle role nomenclature; identify exact cardinalities and transitions; decide specific AI provider, session design, ORM, billing policy and cloud platform; create architecture decision records (ADRs), acceptance criteria and prioritized backlog.
**Deliverables:** source-of-truth matrix; initial ERD mapping; permissions matrix; state-machine documents; data dictionary; API contract index; risk register.
**Exit:** approved scope/technical decisions; any unresolved question labeled with an owner and blocking/nonblocking status.

### P1 — Foundations, workspace and infrastructure
**Tasks:** configure monorepo, TS strict, ESLint, Prettier, GitHub Actions, React/Vite, NestJS app, NestJS worker, PostgreSQL and Docker Compose; environment configuration validation; health check; database migration/seed; CORS/cookie strategy; log correlation IDs; API docs; error format; CI build, lint and tests.
**Deliverables:** reproducible setup, sample test accounts, functional `/api/v1/health`, README + `.env.example`, first versioned migration, basic build pipelines.
**Exit:** new contributor can boot all local services; database reset/reseed works; secrets absent from Git; CI is green.

### P2 — Theme and shared frontend system
**Tasks:** translate every supplied Dart token; implement light/dark themes, Inter, gradients, spacing, radii, elevations, transitions; establish CSS Modules and shared primitives; responsive layouts; accessibility rules and visual regression capture.
**Deliverables:** browser-based component gallery/reference, design token ledger, shared component kit, theme toggle.
**Exit:** code and screenshots confirm color/typography/spacing fidelity; baseline accessibility for buttons, forms and modals.

### P3 — Splash screen, animated logo and public entry
**Tasks:** implement splash/loading entry; CloudPilot orbit logo (central node, orbit/cloud/arrow concept, restrained motion); route-aware initialization; public page shell with header/footer; landing page and eventual placeholders/routes for How It Works, Features, Pricing, Customer Benefits, Provider Benefits, FAQ, Contact, Terms/Privacy; informative not-found/error pages.
**Important:** the product architecture defines an animated logo but **does not explicitly define a splash page**; a branded splash screen is added at the user's request. Don't force an unnecessary splash on every route navigation. Respect reduced-motion settings and avoid artificially delaying startup.
**Exit:** accessible animation, navigation works and theme matches; clean route transition to login/public content.

### P4 — Authentication, profile and onboarding
**Backend:** user account and role schema; registration, login, logout, session refresh/check, optional logout all devices; password hashing; verification/reset tokens; rate limiting; customer profile and organization; RBAC + object ownership; account status/deactivation; security audit.
**Frontend:** register/login/forgot/reset/verification; protected route gates; profile; onboarding wizard per architecture: welcome → how AI negotiation works → intended workload → expected duration → billing cycle → technical familiarity → example → recommended VM → start negotiation. Persist partial progress and allow proper resume/skipping if policy permits.
**Exit:** E2E sign-up/onboarding; no cross-customer access; blocked provider pages; refresh retains session; expired sessions behave correctly.

### P5 — VM catalog, availability, pricing and policies
**Backend:** templates (Nano, Starter, Growth, Performance and validated custom configurations); CPU/RAM/storage/OS constraints; availability/capacity model (simulated); hourly/daily/monthly rates; versioned pricing; discount rules and approval thresholds; provider-only CRUD; auditable updates; historical snapshot retention.
**Frontend:** catalog pages and provider template/pricing/policy management, forms, previews and validation messages.
**Exit:** valid quotes deterministic; outdated pricing doesn't mutate existing deals; discount and minimum-price tests pass.

### P6 — Chat workspace and controlled AI agent
**Backend:** chat sessions/messages, history, structured requirement schema, prompt boundaries, AI adapter, request timeout/retry budget, AI input/output validation, deliberate fallback to manual structured configuration, observable tool-use decisions, conversation state persistence.
**Frontend:** three-column workspace on wide displays: history, messages and structured configuration/price summary; stacked/tabs/drawers on small screens; typing/loading states, suggestions and action controls.
**Conversation state:** NEW → REQUIREMENTS_COLLECTION → CONFIGURATION_RECOMMENDATION → PRICE_CALCULATION → NEGOTIATION → OFFER_READY → CUSTOMER_REVIEW → ACCEPTED → ORDER_CREATED → PROVISIONING → ACTIVE; terminal/side states REJECTED, EXPIRED, ESCALATED, CANCELLED.
**Exit:** chat persists across refresh; extracted requirements are schema-correct; no secret pricing rules or system prompt leaks; AI outages don't corrupt state.

### P7 — Negotiation engine and offer management
**Backend:** deterministic discount boundaries, eligibility, duration and billing-cycle policies; max attempt count, minimum margin/price and provider approval; immutable offer snapshots, pricing version, status transitions, expiry scheduler; counteroffers; audit. The AI may present the validated result, not invent the negotiated rate.
**Frontend:** price breakdown, offers in chat, offer detail/review screen, expiry indicator, decline/accept, provider review queues and rejection explanations.
**Exit:** expired/rejected/unapproved offers can't create orders; offers remain separate from orders; concurrent acceptance cannot double-process.

### P8 — Order confirmation and simulated provisioning
**Backend:** transactional acceptance, idempotency key, availability recheck, one accepted order per intended offer, unique order number, durable provisioning job, `VirtualMachineProvider` interface and simulator, state/event journal and worker recovery. Validate suspended billing-account restrictions.
**Frontend:** explicit `Confirm Deal and Provision VM` screen showing configuration, price, discount, billing cycle, usage assumptions, terms, period and renewal; progress stages Queued → Allocating → Preparing OS → Assigning Network → Booting → Health Check → Ready; failure, retry and cancellation states.
**Exit:** duplicate clicks generate only one order; worker restarts recover jobs; simulated VM reaches active or recoverable failure; user sees truthful status.

### P9 — Simulated VM lifecycle and usage
**Backend:** start, stop, restart, rename, resize (later with upgrade logic), terminate; strict state machine and audit, ownership; simulated hostnames/IP; usage profiles generating bounded/reproducible CPU/memory/storage/network metrics; runtime intervals and lifecycle events.
**Frontend:** VM list/detail, action confirmations, event timeline, simulated read-only terminal/status interface, charts/metrics and empty/loading/errors.
**Exit:** controls do not execute real shell commands; invalid transitions refused; stop/start behavior affects metering correctly; termination irreversible after confirmation.

### P10 — Billing and invoicing
**Backend:** rate snapshots, charge ledger, VM event-based consumption, storage/compute split, hourly/daily/monthly billing, pro-rata boundaries, add-ons, discounts, tax handling configured explicitly, invoice line-items, issuance, simulated payments/credits, reconciliation, invoice status, stable downloadable PDF optional at core/extended boundary.
**Formula:** base billable units × accepted unit rate − allowed discount + add-ons + applicable tax/adjustments. No client-calculated total is trusted.
**Critical tests:** mid-cycle creation, stop/restart, resizing mid-unit, discounts limited to first period, early termination, provisioning failure, many VMs, manual adjustment and double-run invoice job.
**Exit:** generated invoices reconcile with immutable events; repeat job doesn't duplicate invoice; previous invoices retain original prices.

### P11 — Upgrades, downgrades and extensions
**Backend:** new requested configuration → availability/constraints → adjusted quotation → optional negotiation → customer confirmation → resize change job → VM state update → effective billing rate version. Enforce storage-not-below-used, possible restart/maintenance and scheduled downgrades when policy requires it.
**Frontend:** upgrade wizard and AI-triggered upgrade flow, compare old/new configuration and prorated price, progress status, failure recovery.
**Exit:** no resources or charges change before approval; failed resize doesn't partially change accepted configuration/bill.

### P12 — Customer and provider dashboards and analytics
**Customer:** overview, active VMs, AI negotiation, offers, orders, usage, billing, invoices, support, notifications, profile/security, activity, empty states.
**Provider:** KPIs, customers/detail, templates, pricing, policies, deal review/manual overrides, orders, VMs, billing/invoices, analytics, audits, support and settings; team management only if later scope.
**Backend:** scoped aggregate queries, paginated/filterable tables, provider permissions, auditable override reasons, consistent KPI definitions.
**Exit:** dashboard numbers match source records; customer/provider cross-role reads/writes are impossible; tables usable on smaller screens.

### P13 — Notifications, support, audit and completeness
**Backend:** in-app notifications on deal readiness/expiry, provisioning, VM events, invoices and upgrades; provider alerts; delivery/read state and job retries; support ticket records and staff assignment if in scope; audit for pricing/overrides/VM actions/auth and invoicing.
**Frontend:** notifications center with read/unread states, ticket form/status/detail, provider review, audit viewer, announcements and system states (access denied, network error, session expired, 404, maintenance, empty).
**Exit:** relevant transactions create traceable events; notifications not duplicated from retries; users see only authorized records.

### P14 — Security, QA, performance, Docker and cloud release
**Tasks:** threat model, OWASP-oriented review, secret management, CSRF/CORS/cookie rules, throttling, input validation, AI prompt-injection and output constraints, IDOR/privilege tests, replay protection, HTTPS, security headers, log redaction, backups and restore drill; load/latency profiling, DB index review, accessibility/responsive/browser tests, analytics verification, demo seed and failure simulation.
**Deploy:** React static host; NestJS API container; worker container; managed PostgreSQL; migrations as controlled deploy job; readiness/health endpoints, metrics/central logs, alerting, rollback, backup retention, smoke tests and GitHub Actions CI/CD. Document environment-specific configurations and domain/SSL.
**Exit:** green end-to-end run in deployed staging and production-like target, restore procedure demonstrated, no critical open security defects, complete demo usable.

### P15 — Optional/advanced extensions (after core acceptance)
- Staff/support role with assignments and escalation.
- Multiple independent organizations/providers, organization scoping and ownership migration.
- Promotional campaigns and sophisticated policy rules.
- Real email service with delivery monitoring.
- Payment gateway **sandbox only** (never production bank settlement in semester release).
- Refined resource availability simulation and AI workload recommendations.
- Real-time status via SSE/WebSocket if polling is inadequate.
- Real/cloud adapter exploration **outside the first-release scope**.

## 7. Cross-module backend boundaries

| NestJS domain | Core responsibility | Key invariants |
|---|---|---|
| Auth / Users / Organizations | Identity, sessions, profile, roles | No role claimed by frontend; scoped access |
| Onboarding | Preferences, progress | Resumable user-owned records |
| Catalog | Template/OS/capacity registry | No inactive/invalid template orders |
| Pricing | Rate rules, version snapshots | Existing accepted prices unchanged |
| Policy | Negotiation limits | Discounts/minimums enforced by backend |
| Conversations / AI | Chat, extraction, tool calls | AI intentions ≠ authoritative actions |
| Negotiation / Offers | Counters, expiry, approval, status | Expired offer never accepted |
| Orders | Commitments, state, confirmation | Atomic, confirmed once, idempotent |
| Provisioning / VMs | Adapter, job progress, VM transitions | Owners only; legal state changes |
| Usage | Events, runtime, metering | Reproducible; invoice-ready immutable intervals |
| Billing / Invoices | Ledger, totals, adjustments | No doubles; historical pricing retained |
| Upgrades | Change proposals, resize, rate effects | No partial changes on failure |
| Provider / Analytics | Authorized administrative views | Metrics sourced from persisted truth |
| Notifications | User/provider notices | Event-linked and retry-safe |
| Support | Tickets / replies / assignment | Scoped visibility |
| Audit | History of sensitive actions | Append-only, with actor and reason |

For module API and frontend scope, derive actual route and request/response schemas from the final design pack rather than assuming undocumented payloads. Candidate routes below are **implementation proposals**.

## 8. Candidate REST API inventory

| Module | Proposed endpoints |
|---|---|
| Health | `GET /api/v1/health`, `GET /api/v1/ready` |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh-or-session`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `GET /auth/me` |
| Onboarding | `GET/PATCH /onboarding`, `POST /onboarding/complete` |
| Users | `GET/PATCH /me/profile`, `GET/PATCH /me/security` |
| Catalog | `GET /vm-templates`, `GET /vm-templates/:id`, provider-authorized CRUD routes |
| Pricing | `POST /pricing/quotes`, `GET /pricing/versions`, provider-only `POST /pricing/versions` |
| Policy | `GET/PUT /provider/negotiation-policies` |
| Chat | `GET/POST /chat/sessions`, `GET /chat/sessions/:id/messages`, `POST /chat/sessions/:id/messages` |
| Offers | `GET /offers`, `GET /offers/:id`, `POST /offers/:id/decline`, `POST /offers/:id/confirm` |
| Orders | `GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel` |
| VMs | `GET /vms`, `GET /vms/:id`, `POST /vms/:id/start|stop|restart|terminate`, `PATCH /vms/:id` |
| Provisioning | `GET /orders/:id/provisioning`, guarded retry endpoint |
| Usage | `GET /vms/:id/usage`, `GET /vms/:id/events` |
| Billing | `GET /billing/summary`, `GET /invoices`, `GET /invoices/:id`, `GET /invoices/:id/download` |
| Upgrades | `POST /vms/:id/upgrade-requests`, `GET /upgrade-requests/:id`, confirm endpoint |
| Provider | `/provider/dashboard`, `/provider/customers`, `/provider/deals`, `/provider/orders`, `/provider/vms`, `/provider/analytics`, `/provider/audit-logs` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read` |
| Support | `GET/POST /support/tickets`, `GET /support/tickets/:id`, reply/assignment endpoints |

All sensitive endpoints require authorization, ownership and relevant account status checks. Define exact REST method, idempotency and request contract during each phase and publish Swagger/OpenAPI.

## 9. Database roadmap (PostgreSQL)

### Original architecture table set (preserve intent)
`users`, `organizations`, `organization_members`, `customer_profiles`, `vm_templates`, `pricing_versions`, `pricing_rules`, `negotiation_policies`, `chat_sessions`, `chat_messages`, `offers`, `orders`, `virtual_machines`, `vm_state_events`, `usage_records`, `billing_accounts`, `invoices`, `invoice_items`, `upgrade_requests`, `notifications`, `support_tickets`, `audit_logs`.

### Additional supporting tables/structures to decide during ERD reconciliation
- `sessions`, `verification_tokens`, `password_reset_tokens` (or a consistent secure session/token design).
- `onboarding_progress` (or equivalent account/profile columns).
- `provisioning_jobs`, `job_attempts` and durable `outbox_events`.
- `offer_approvals` or equivalent structured provider approval history.
- `payment_records` / `billing_adjustments` for clearly labeled simulated payments/credits.
- `vm_usage_intervals` / immutable rating ledger if `usage_records` alone cannot support billing correctness.
- `idempotency_keys` or uniqueness constraints for confirmation, jobs and billing.

**Caveat:** These are *proposals*, not claims that the completed ERD already includes them. Resolve implementation additions in an ADR and update ERD/migration docs only with explicit engineering agreement.

### Data correctness rules
- UUID primary keys or other consistently chosen strategy; explicit unique constraints for emails/order numbers/offer acceptance/invoice cycle.
- Money as PostgreSQL `numeric(p,s)` / safely handled integer minor units; never JS binary floating point for accounting.
- Foreign keys and indexes for owner/VM/order/offer, status, time series and audit.
- `created_at`, `updated_at`, transactional version fields where needed; timezone-aware timestamps.
- Snapshots (accepted rate, currency, configuration, discount, period) stored with offers/orders/invoices.
- Simulated metrics labeled as simulated in UI and data lineage.
- Migrations tracked in Git, reproducible seeds with no real secrets; deploy-safe migration/rollback policy.
- Retention and minimization policy for potentially sensitive chat transcripts, profile data and logs.

## 10. Screen inventory and ownership

### Public site
Splash/brand entry (new request); landing; how-it-works; features; customer benefits; provider benefits; pricing; FAQ; contact; login; register; forgot/reset password; email verification; terms/privacy; generic 404/error.

### Customer portal
Onboarding; overview dashboard; AI chat/history; offer review; order confirmation; provisioning status; VM list; VM details; simulated terminal; usage analytics; billing summary; invoices list/detail/download; upgrades; order history; notifications; support tickets; profile/security; account deactivation/deletion confirmation.

### Provider portal
Overview dashboard; customers list/detail; VM templates list/create/edit; pricing versions/editor; policy configuration; deals list/detail/manual review; orders; VM list/detail; billing/invoice management; revenue/usage analytics; support management; audit viewer; settings; optional team management.

### Cross-cutting state screens/components
Access denied, not found, maintenance, session expired, network failure, AI unavailable, provisioning failed, insufficient privilege, offer expired, empty dashboard, empty chat/list, loading/skeleton, optimistic action rollback and confirmation dialogs.

**Screen completion standard:** actual API integration, correct authorization and routing, responsive layout, full light/dark styling, loading/empty/error/success cases, validation, keyboard/a11y support and tests. A pixel-perfect static screen alone is not marked complete.

## 11. Critical workflow contracts and edge cases

### A. New customer rents a VM
Landing → registration → verification (if enforced) → onboarding → AI chat → structured requirements → template recommendation → backend price → constrained negotiation → persisted offer → explicit review → authenticated atomic acceptance → order → worker provisioning → active VM → usage and billing start.

### B. Discount negotiation
Customer request → AI extracts intent → backend checks discount eligibility/max/minimum margin/attempt count → server computes offer/counteroffer → user review → confirm or provider escalation. Invalid requests do not create pricing authority.

### C. Upgrade an active VM
Owned VM → request changes → check resources and restrictions → quote against correct price snapshot/effective date → confirm → resize job → atomic state/update of active config and future billing rate → audit.

### D. Stop and restart
Confirmation modal → ownership/account/state guard → STOPPING → STOPPED event and usage compute cutoff; restart → BOOTING → RUNNING → resume compute metering. Storage charges while stopped require agreed billing rule. Termination halts future charges.

### E. Provider changes pricing
Authorized provider → validated edits → **new** pricing version → future offers use it → existing accepted order/invoice snapshots unchanged → audit old/new and reason.

### F. Provisioning fails
Worker failure → retryable error state; customer/provider notification; bounded retries with idempotency; cancel/refund-or-credit rules as determined by simulated billing policy; track entire event history.

### Concurrency/failure matrix (mandatory tests)
- Double-click accept and simultaneous accept on two tabs.
- Offer expires during user confirmation.
- Price/policy changed after offer presentation.
- Customer suspended between offer and acceptance.
- AI returns invalid schema, unsupported VM, or fake discount.
- AI service timeout or repeated tool call.
- Worker crash mid-provisioning or mid-invoice issuance.
- Duplicate usage ticks, overlapping time ranges and billing jobs.
- VM stop/restart/resize during billing boundary.
- VM termination with unpaid invoice.
- Unauthorized access by modifying customer/VM IDs.
- Provider override without reason or requisite privileges.
- Mixed timezones and daylight savings in display vs UTC ledger.
- Mobile network retries and stale frontend cache.

## 12. Testing matrix and quality gates

| Layer | Test technique | Required proof |
|---|---|---|
| Domain calculations | Unit tests | Pricing, discounts, expirations, billing, pro-rata and states |
| Controllers/guards | NestJS integration | DTO validation, RBAC, ownership, error codes |
| Database | PostgreSQL integration | Transactions, concurrency, migrations, constraints |
| AI boundary | Schema-based contract + adversarial cases | AI never bypasses policy/authorization |
| Worker | Recovery/idempotency tests | Retry safe, no duplicated orders/invoices |
| React | Component/interaction tests | Inputs, dialogs, navigation, state components |
| UI visuals | Responsive and regression screenshots | Theme fidelity in light/dark on representative widths |
| Accessibility | Automated + keyboard manual checks | Focus, labels, contrast, reduced motion, semantic structure |
| End-to-end | Browser workflow tests | Main flow A, B, C, D, E and failure F |
| Security | Threat-model scenarios | IDOR, CSRF, forged values, replay, injection and leakage blocked |
| Deployment | Smoke/restore drill | Live API, UI, worker, DB and backups functional |

**Definition of Done (every feature):** specification reference + acceptance criteria; backend rules; typed frontend integration; UI states; validated forms; unit/integration/E2E coverage appropriate to risk; auth/ownership checks; responsive/accessibility; audit/telemetry; docs and CI green.

## 13. Scope and execution priorities

**Milestone M1 — Design foundation:** P0–P3, running app plus exact theme, splash and public shell.

**Milestone M2 — Account foundation:** P4–P5, users/onboarding and provider-managed VM plans/rates.

**Milestone M3 — Sellable workflow:** P6–P8, chat to bounded offer to order to simulation.

**Milestone M4 — Operable cloud portal:** P9–P11, VM actions, usage, billing/invoicing, upgrade.

**Milestone M5 — Complete administration and release:** P12–P14, dashboards, notifications, support, audit, secure deployment.

**Optional milestone M6:** P15, independent enhancements after end-to-end MVP success.

Follow the architecture source's priorities: Level 1 (essential MVP), then Level 2 (strong academic project), then Level 3 (advanced). Never allow an optional component to delay a working end-to-end core flow.

## 14. Milestone release and GitHub gates

- `v0.1-foundation`: React + NestJS + DB + CI; theme and splash work locally.
- `v0.2-identity`: registration, login, profile/onboarding, guarded routes.
- `v0.3-negotiation`: VM catalog, pricing, chat, deterministic offers.
- `v0.4-provisioning`: confirmed orders, worker, simulated VM controls.
- `v0.5-billing`: usage, invoices, upgrades, provider business management.
- `v0.9-release-candidate`: full portals, notification/audit, hardening, staging demo.
- `v1.0-semester-demo`: verified deployed product and demonstration documentation.

These are milestone labels, not dates or promised completion times.

## 15. Demonstration dataset and scripted scenario

Seed a provider admin, a customer, a sample pricing policy and VM templates Nano (1 vCPU / 1 GB / 25 GB), Starter (2 / 4 / 50), Growth (4 / 8 / 100), Performance (8 / 16 / 250). Use hypothetical prices and label demos honestly. Include representative completed invoices, active/paused VMs, a pending review case and a controlled provisioning failure.

**Demo script:** Open CloudPilot landing/splash → register/login → complete onboarding → “I need a Linux server for a small web application for 30 days” → AI asks for missing load and recommends Starter → customer requests discount → backend applies permitted policy → customer explicitly accepts → confirmed order → provisioning progress → VM active → stop/restart → usage charts and current bill → request extra RAM → confirm upgrade → provider dashboard reviews transcript, policy, pricing, usage, analytics and audit → simulate failure and demonstrate retry.

Provide demonstration reset/seed procedure, test accounts with disposable demo credentials stored securely, a short click-through script and backup screen captures in case network/AI provider becomes unavailable.

## 16. Risk register and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Theme drift vs supplied Dart tokens | Inconsistent product identity | Single tokens and theme reference gallery, visual regression |
| Next.js remnants from old document | Conflicting architecture | ADR documenting React SPA + NestJS replacement |
| AI creates unauthorized deals | Invalid business actions | Structured outputs, server-enforced calculations and confirmations |
| Inaccurate bills | Financial inconsistency | Event-ledger, rate snapshots, decimal math, exhaustive cases |
| Unreliable worker simulation | Stuck orders or duplicates | Durable jobs, bounded retries, state journal, idempotency |
| Over-large semester scope | Incomplete demo | Strict MVP then strong-project then advanced priority |
| Cross-customer data exposure | Security/privacy | Auth guard + owner/organization scope + IDOR tests |
| Incompatible final ERD | Data model rework | Reconcile finalized design diagrams at P0 |
| AI dependency down at demo | Broken main scenario | Deterministic scripted fallback/mock, saved chats, graceful errors |
| Poor mobile UI | Missing responsive product requirement | Mobile layouts and automated visual checkpoints each phase |
| Deployment fragile | Demo unavailable | Dockerized API/worker, managed DB, backup/rollback/smoke tests |

## 17. Pending choices requiring explicit engineering decision

These are **not omissions that should be filled with imaginary certainty**:

1. Finalized diagram package review: actual ERD keys/cardinalities, class responsibilities, transition diagrams and exact UML use-case mapping.
2. AI provider/model/budget and strict structured output contract; mock adapter maintained regardless.
3. ORM selection (Prisma proposed) and migrations ownership.
4. Session/cookie/auth design, frontend/API domain setup and CSRF behavior.
5. Stopped VM billing treatment; storage charges recommendation must become an explicit tested policy.
6. Simulated payments vs manual records and when orders become confirmed, since source order states mention `PENDING_PAYMENT` but the semester excludes real settlement.
7. Whether provider admin review is mandatory for certain policy thresholds and its effect on offer expiry.
8. Hosting vendor, cloud-region and production DNS/SSL.
9. Organization model scope (single-provider first vs multiple organizations later).
10. Exact visual assets and wordmark: architecture contains an animated-logo *concept*, not a completed artwork asset.

The recommended default is to record these as ADRs during P0, leaving core architecture reusable without guessing hidden user decisions.

## 18. Immediate next development session — Splash + Onboarding

The user's announced next development target is **Splash Screen and Onboarding Screen**. The immediate implementation sequence should be:

1. Complete the minimal P0/P1/P2 dependencies: architecture alignment, working React project, CSS theme tokens and shared primitives.
2. Implement branded CloudPilot splash/animated logo with light/dark behavior, responsive dimensions and reduced-motion variant.
3. Implement onboarding page layout as reusable steps using the finalized theme and progress indicator.
4. Wire onboarding navigation and draft state locally with a typed interface; integrate real persisted NestJS endpoints after identity backend is ready.
5. Align auth behavior: onboarding occurs **after registration** in the source architecture; while screens may be developed earlier, the actual user journey must not pretend a customer is registered when they are not.
6. Test mobile, tablet, desktop, refresh/navigation, empty/error/loading and accessibility cases.
7. Only after the preceding screens meet acceptance criteria proceed to next milestone.

**Acceptance criteria for splash:** exact brand colors; Inter; CloudPilot orbit concept; no infinite loading; reduced-motion; meaningful routing; no forced delay; browser/mobile compatibility.

**Acceptance criteria for onboarding:** welcome and explanation; workload, duration, billing, expertise; example negotiation; starter VM recommendation; resumability; Next/Back/validation; loading/error/success states; accessible forms; theme parity. Confirmation of actual API persistence requires completed authentication/onboarding backend.

## 19. Final build invariants and sign-off checklist

- [ ] Frontend React/TSX/CSS, backend NestJS/Node, PostgreSQL, Docker, GitHub and cloud host only as finalized baseline.
- [ ] Superseded Next.js/Tailwind/navy/cyan recommendations do not leak into implementation.
- [ ] Dart theme faithfully converted to web tokens, Inter type scale and accessible light/dark interface.
- [ ] Every required architecture module and primary screen has a backlog item with acceptance tests.
- [ ] Completed design diagrams reconciled with DB schema and state machines.
- [ ] Role permissions and per-customer ownership checked in services and endpoints.
- [ ] AI can propose but never independently confirm or execute a sensitive action.
- [ ] Provider pricing/policy boundaries determine final offers, not an LLM-generated number.
- [ ] Offers expire; orders require explicit atomic acceptance; duplicate calls are safe.
- [ ] Simulated VM adapter, durable worker and failure/retry flows are implemented.
- [ ] Usage events, pricing snapshots and bill/invoice ledger remain internally consistent.
- [ ] Customer/provider dashboards show real persisted data, not permanently hardcoded examples.
- [ ] CI, unit/integration/E2E, accessibility/security and deployment smoke tests pass.
- [ ] Deployed semester demo clearly labels simulated functionality.

---

**Final implementation rule:** Develop vertically in short, verifiable increments. No phase is finished merely because the page looks good; the data contracts, validation, tests and workflows must function. The next practical coding task is **theme foundation → splash screen → onboarding UI**, consistent with the user's stated plan.
