# CloudPilot contributor instructions

Read `docs/repository-structure.md` before adding files. It is the source of truth for current and planned code paths. Planned feature folders have a `.gitkeep` marker until implementation adds real files, then remove that marker. Keep the roadmap and backend backlog aligned with the structure whenever a planned module or workflow changes.

## Placement

- Web code belongs in `apps/web/src/`. Keep feature-specific UI and state inside `src/features/<feature>/`, shared product components in `src/components/`, and preserve the existing `src/design-system/` CSS files.
- Backend domain code belongs in `apps/api/src/modules/<domain>/`. Cross-cutting NestJS code belongs in `src/common/`; configuration in `src/config/`; PostgreSQL runtime access in `src/database/`; health endpoints in `src/health/`; worker startup in `src/worker/`. Keep versioned SQL migrations and seed data in the repository-root `database/` folder.
- Backend tests belong in `apps/api/test/{unit,integration,e2e}/`. Frontend tests belong in `apps/web/src/test/` or the colocated feature test when they exercise feature-specific behavior.
- Engineering references belong in `docs/{adr,api,database,runbooks}/`. Preserve all academic submissions, planning references, and supplied diagrams in their current `supporting-documents/` folders.
- Keep `compose.yaml` and the root `Dockerfile` at the repository root. Use the root npm workspaces and one `package-lock.json`.

## Project rules

- Keep the backend a NestJS modular monolith. Do not add a separate worker service, ORM, queue service, cloud provider, or external payment gateway without an accepted decision recorded in `supporting-documents/planning/CloudPilot-Master-Development-Roadmap.md`.
- The AI may collect and explain requirements. Backend domain services calculate offers, authorize transitions, verify simulated payments, and grant access only after a VM is ready.
- Keep offer acceptance, invoice issuance, payment verification, and resource access as separate states. Make repeated confirmation idempotent and preserve ownership checks.
- Do not commit secrets, `.env`, local database files, `node_modules/`, build output, coverage output, or generated submission archives.
- Use only the member's assigned long-lived branch (`Shadan` or `Ayan`). Merge to `main` through a reviewed pull request after the build and applicable tests pass. Update the member branch from the latest `main` before continuing work.
