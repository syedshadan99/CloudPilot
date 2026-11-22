# ADR 0005: Reconcile duplicate migration history

## Decision

Keep `0004_cloudpilot_foundation.sql` as the canonical version 4 migration and
keep the existing corrective migrations `0005` through `0008` unchanged. Remove
the duplicate teammate files `0004_upgrade_requests.sql` and
`0005_notifications_support_audit.sql` from the runnable `.sql` directory. The
files remain recoverable in Git history and are not replayed under new numbers.

The canonical version 4 migration already creates `upgrade_requests`,
notifications, support, and audit tables with UUID foreign keys, lowercase
state values, and normalized configuration column names. The duplicate upgrade
migration used a conflicting VARCHAR/uppercase-state schema and its
`CREATE TABLE IF NOT EXISTS` could not repair the canonical table.

Migration `0010_upgrade_requests_compatibility.sql` adds only the retry and
customer-confirmation columns required by the existing upgrade module and a
unique active-request index using the canonical status vocabulary. The
repository maps the module's legacy response/status contract to canonical
database columns and states; it does not rewrite historical rows.

## Compatibility and safety

- Migrations `0001`–`0009` are unchanged.
- No table is dropped or replaced.
- No existing migration checksum or `schema_migrations` row is fabricated.
- Existing upgrade configurations and price deltas remain in canonical columns.
- Existing active duplicate requests cause migration failure rather than being
  deleted or silently merged.
- Clean databases build the canonical schema, then apply `0010`, then CP-05.
