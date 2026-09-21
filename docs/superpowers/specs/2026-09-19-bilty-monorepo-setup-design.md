# Digital Bilty Platform — Foundation Design Spec

Revised 21 September 2026. Supersedes the original seven-entity scaffold design. Product requirements are in `docs/prd.md`; exact fields are in `docs/fields.md`.

## First slice

Deliver a strict TypeScript pnpm workspace with serializable shared types, bilty domain operations, a NestJS module/service, TypeORM migrations and real PostgreSQL integration tests. A Next.js App Router app remains the planned frontend, but is not scaffolded in this slice. Do not mistake the Claude Design HTML export for Next.js source.

## Structure

- `packages/shared-types/src/index.ts`: document, snapshot, membership-context and audit contracts.
- `apps/api/src/modules/bilty/validation.ts`: runtime schema, defaults and issue requirements.
- `apps/api/src/modules/bilty/money.ts`: exact paise totals and Indian amount-in-words.
- `apps/api/src/modules/bilty/domain.ts`: pure draft/edit/issue/cancel functions and print projection.
- `apps/api/src/modules/bilty/bilty.service.ts`: tenant verification, persistence, transactional locking and audits.
- `apps/api/src/modules/bilty/bilty.module.ts`: Nest provider integration; requires a configured TypeORM DataSource.
- `apps/api/src/database/`: explicit migration and migration runner; automatic schema synchronization disabled.
- `apps/api/test/`: domain tests and isolated PostgreSQL integration tests.

## Storage design

Use relational company, membership and saved-party tables. Store bilty metadata (id, company, version, status, number, timestamps) relationally with a validated JSONB document aggregate and issued company snapshot. Repeatable e-way bills and invoices live in that aggregate; this replaces the proposed separate EwayBill controller/entity so references cannot be fetched or updated outside the owning bilty's tenancy/audit boundary. Audit events use a separate insert-only application table with a same-company composite foreign key to bilty.

All IDs are UUIDs. JSON uses ISO date strings, integer paise and decimal measurement strings; it does not mirror ORM `Date`/numeric types. Domain types contain no invitation tokens. Company print fields and party snapshots are copied into issued records. Party source edits never alter existing document data.

## Transaction rules

- Validate active membership inside every transaction. A shared row lock keeps revocation and mutations ordered.
- Read/lock bilty by both company ID and bilty ID; never fetch by ID then rely on frontend filtering.
- Lock company counter for issuance and commit counter increment, document state and audit together. `(company_id, number)` is unique; multiple null draft numbers are permitted.
- Retry already-issued issuance returns its existing identity. A cancelled record cannot issue again.
- Edits/cancellation require expectedVersion; stale version fails. Issued edits need a reason and full validation. No-op writes produce no audit.
- Referenced consignor/consignee must belong to the company and have the matching party kind.
- No controller is exposed until authentication and transport validation are implemented.

## Authentication follow-up contract

Google OAuth, normalized email invitations with hashed single-use tokens, rotated/revocable refresh sessions, platform-admin separation and HTTP guards are required before external access. Membership verification in this slice is authorization, not a replacement for authentication.

## Verification and delivery

`pnpm check`: strict typecheck, domain tests and build.
`pnpm test:docker`: isolated disposable PostgreSQL 16 via Docker Compose following doma-backend conventions; migration round-trip, persisted snapshots/audit, denial cases, rollback, stale writes and concurrent issuance.
Dependencies are pinned by pnpm-lock.yaml; do not copy historical Next 14/Nest 10 dependency examples into a new app.

## Following slices

1. OAuth, onboarding, invitations and authenticated HTTP DTO/controllers.
2. Next.js screens adapted from the design reference, with shared contracts.
3. A4/thermal PDF layouts using the common print projection, then controlled sharing.

The first slice intentionally does not implement these three follow-up areas. The project is not deployable as an authenticated web application yet.

## Local infrastructure

Docker Compose runs development PostgreSQL with a persistent volume and health checks. The integration runner creates an independent ephemeral Compose project and random localhost port. See docs/docker.md. Native PostgreSQL is not required.
