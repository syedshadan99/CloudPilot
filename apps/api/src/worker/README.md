# API background worker

The worker is a second NestJS entry point in the API workspace. Keep job startup and scheduling code here. Keep the job handler beside the domain it serves, for example in `src/modules/provisioning/jobs/`. Use the PostgreSQL-backed job or outbox design in the roadmap. Do not add Redis, BullMQ, a separate worker app, or an ORM without an approved architecture decision.
