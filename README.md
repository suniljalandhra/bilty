# Bilty Digital Platform

V1 backend foundation for a multi-company digital bilty / goods receipt application.

## Implemented in this slice

- Shared TypeScript document and audit contracts.
- Runtime validation for partial drafts and complete issued documents.
- Multiple e-way bill and invoice references; separate actual/chargeable weight and CBM.
- Exact integer-paise charge totals and Indian amount-in-words.
- Issue, edit, cancel and no-op rules; full before/after audit snapshots; optimistic versions.
- TypeORM/PostgreSQL migration and tenant-scoped service with active membership checks, transaction locks, unique company numbering and transactional audit writes.
- NestJS module exporting the service. No HTTP routes are exposed.

**Verification:** 17 domain tests and 11 real PostgreSQL integration tests pass. The integration suite runs in an isolated Docker Compose project. Typecheck and build pass. Docker test resources are removed automatically; development data lives in a separate persistent volume.

## Docker workflow

Use the same infrastructure-first pattern as doma-backend:

```sh
pnpm docker:dev
pnpm docker:migrate
pnpm test:docker
pnpm docker:stop
```

PostgreSQL runs in Docker; development uses a persistent volume and tests use a separate disposable database. See [Docker setup](docs/docker.md).

## Setup and commands

Requires Node.js 22+ and pnpm 10.33.0. The lockfile records exact dependencies.

```sh
pnpm install --frozen-lockfile
pnpm check
```

- `pnpm format:check`: checks formatting.
- `pnpm build`: builds shared types then backend library.
- `pnpm typecheck`: builds shared declarations, then checks source and tests.
- `pnpm test`: domain regression tests; no database needed.
- `pnpm db:migrate`: applies the initial migration to `DATABASE_URL`. Requires an existing database. Schema synchronization is disabled.
- `pnpm test:integration`: tests persistence against `BILTY_TEST_DATABASE_URL` with `BILTY_TEST_ALLOW_RESET=yes`.

Integration tests **drop and recreate the public schema** in the explicitly selected test database. Never point the test URL at a development, shared or production database. No fallback to `DATABASE_URL` exists. Tests cover migration rollback/reapply, lifecycle persistence, ownership denial, revoked membership, invalid party references, snapshot preservation, concurrent issuance/retries, transaction rollback and stale edits.

Environment variables must be set in your shell; `.env.example` documents them and no `.env` file is loaded automatically. A dedicated least-privilege runtime database role and migration role should be provisioned before deployment.

## Application integration

A future Nest application should initialize and own the lifecycle of the DataSource, then import `BiltyModule.forDataSource(dataSource)`. The service exports:

```ts
createDraft(actor, rawData);
get(actor, biltyId);
list(actor); // newest 100 records; HTTP slice will add cursor pagination
issue(actor, biltyId, expectedVersion);
edit(actor, biltyId, expectedVersion, replacementData, reason);
cancel(actor, biltyId, expectedVersion, reason);
history(actor, biltyId);
```

`actor` must come from verified authentication, not a request body. The service checks active database membership for every call but does not authenticate a Google identity itself. The initial `memberships` table represents one company per user. Provisioning companies, memberships and saved parties belongs to the onboarding slice; current integration fixtures seed them solely for tests.

`edit` replaces the complete document data, not a partial patch. Missing optional fields receive defaults. Send the current full data object with intended changes and its version. The service uses saved-party references for ownership checks; explicit snapshot values are the document values, so selecting an address-book entry in the frontend must populate those fields.

`BiltyError.code` is VALIDATION, NOT_FOUND, FORBIDDEN or CONFLICT. Future transport should map these to 400, 404, 403 or 409 respectively, without exposing raw database errors. Both future PDF layouts must consume `printData(record)` for identical totals, references, snapshots and watermarks.

## Documents

- [Canonical V1 PRD](docs/prd.md)
- [Field dictionary](docs/fields.md)
- [Foundation design](docs/superpowers/specs/2026-09-19-bilty-monorepo-setup-design.md)
- [Implementation plan/status](docs/superpowers/plans/2026-09-21-bilty-core.md)
- [Claude Design handoff](docs/prototype-handoff.md)

## Next slices

Google OAuth/session management, company/employee/invitation CRUD, authenticated HTTP controllers and DTOs; then Next.js UI; then rendered PDFs and controlled sharing. Invite hashing, single-use/expiry handling and refresh rotation are documented requirements, not implemented features. The Claude Design export remains unchanged and still has the prototype bugs listed in the handoff. This repository is not yet a complete runnable web application.
