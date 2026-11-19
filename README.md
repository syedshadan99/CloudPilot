# CloudPilot

> **Negotiate. Provision. Scale.**

CloudPilot is a semester project for AI-assisted cloud VM rental. Phase 1 provides a public entry screen, a NestJS API with health checks, and a local PostgreSQL database.

## Run locally with Docker

Start Docker and check that `docker compose version` works. Open a terminal at the repository root and copy the example environment file.

```powershell
Copy-Item .env.example .env
```

On macOS or Linux, use `cp .env.example .env`. Replace the password placeholder in `.env` with a local development password before the first startup.

```sh
docker compose up --build
```

Once Vite and NestJS have started, open [the CloudPilot entry screen](http://localhost:5173). Run these checks from a second terminal.

```sh
docker compose ps
curl --fail http://localhost:3000/health
curl --fail http://localhost:3000/health/db
docker compose exec web npm run build --workspace @cloudpilot/web
```

Use `curl.exe` in Windows PowerShell. The API health check returns `{"status":"ok"}`. The database check runs `SELECT 1` and returns `{"status":"ok","database":"reachable"}` when it succeeds or HTTP 503 when PostgreSQL is unavailable.

If a port is busy, set `WEB_PORT` or `API_PORT` in `.env` and use that port in the URLs above. Rerun `docker compose up --build` to pick up source changes. Use `docker compose down` to stop the stack. Compose stores local PostgreSQL data in the named `postgres-data` volume.

### Run the apps with Node.js

With Node.js 24 and npm 11, install from the lockfile and build both apps.

```sh
npm ci
npm run build
```

Start each app in its own terminal.

```sh
npm run dev --workspace @cloudpilot/web
npm run start --workspace @cloudpilot/api
```

For the database check, set `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` in the API terminal before starting it. Point them at a running PostgreSQL database. The default web and API URLs are the same as in the Docker setup.

## First demo

The [approved first-demo workflow](supporting-documents/planning/CloudPilot-First-Demo-Workflow.md) defines when CloudPilot can issue an invoice, verify a simulated payment, provision the VM, and grant customer access. Authentication, chat, invoices, payments, provisioning, dashboards, and cloud deployment are later milestones.

## Project structure

The [repository structure guide](docs/repository-structure.md) defines where current and planned files belong. [AGENTS.md](AGENTS.md) gives contributors and coding agents the placement rules.

```text
CloudPilot/
├── apps/web/                 React UI, feature areas, existing design system
├── apps/api/                 NestJS API, domain modules, PostgreSQL runtime, worker
├── database/                 PostgreSQL migrations and seed data
├── docs/                     Engineering API, database, ADR, and runbook docs
├── supporting-documents/     Academic submissions, planning, source diagrams
├── .github/workflows/        Build and verification workflows
├── scripts/                  Repeatable repository commands
├── artifacts/submissions/   Generated handoff ZIPs, kept out of Git
├── compose.yaml              Local PostgreSQL, API, and web services
├── Dockerfile
└── package.json              npm workspaces and the single lockfile
```

The future feature folders are mapped in the structure guide and created when the feature is implemented. Build output and submission archives are generated artifacts, not source files.

## Git branches and reviews

Work on your assigned long-lived branch, `Shadan` or `Ayan`. Push only to that branch. Open a pull request from it to `main`, get a review, and confirm the build and relevant tests pass before merging. After `main` changes, merge its latest version into your branch before continuing. See the [backend submission backlog](supporting-documents/planning/CloudPilot-Backend-Submission-Backlog.md) for task ownership and checks.

- [Academic submissions](supporting-documents/academic) contains the semester proposal and first deliverable.
- [Planning references](supporting-documents/planning) contains the requirements, architecture, and development roadmap.
- [Design diagrams](supporting-documents/diagrams) contains the full diagram set and the updated sequence diagrams.

## Team

- Syed Shadan Raza
- M Ayan Hamdani
- Usaid
- Bilal

---

*Semester Project - AI-Powered Cloud Negotiation and Provisioning Portal*
