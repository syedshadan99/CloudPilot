# Database assets

This folder is reserved for PostgreSQL assets shared with local development and backend setup.

- `migrations/` contains ordered, versioned SQL schema changes.
- `seeds/` contains repeatable local or demo seed data.

NestJS connection and health-check code stays in `apps/api/src/database/`. No ORM is selected for this project.
