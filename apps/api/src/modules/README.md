# API domain modules

Create one NestJS folder per domain under `src/modules/`. Use these planned names:

`identity`, `onboarding`, `catalog`, `pricing`, `chat`, `negotiation`, `offers`, `orders`, `payments`, `provisioning`, `vms`, `upgrades`, `usage`, `billing`, `provider`, `analytics`, `notifications`, `support`, and `audit`.

Each implemented module owns its controller, service, DTOs, repository, and domain tests as needed. Keep cross-cutting guards, filters, pipes, and interceptors in `src/common/`. Keep PostgreSQL runtime access in `src/database/`, and versioned SQL migrations and seeds in the repository-root `database/` folder. Keep domain behavior in its owning module rather than a shared catch-all service.
