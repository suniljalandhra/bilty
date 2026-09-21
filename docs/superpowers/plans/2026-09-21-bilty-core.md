# Bilty core implementation plan

**Goal:** Reconcile the reviewed requirements and deliver a tested domain and PostgreSQL persistence slice.
**Architecture:** Shared serializable types; runtime-validated immutable document operations; a NestJS service using TypeORM transactions and PostgreSQL locks. No unauthenticated HTTP routes.
**Spec:** ../specs/2026-09-19-bilty-monorepo-setup-design.md and ../../prd.md.
**Execution:** Inline in an isolated temporary workspace, then copy reviewed changes into the requested repository. Existing commit guidance is retained; AGENTS.md command and architecture notes are updated to match the implementation.

## Constraints

- NestJS + TypeORM + PostgreSQL; pnpm workspace; strict TypeScript.
- No OAuth implementation, Next.js screens or PDF generation in this slice.
- Money is integer paise, dates are ISO strings, measurements are decimal strings.
- Membership and ownership checks precede data access; callers supply an authenticated identity, never a request-body role.

## Task 1: Requirements and workspace

- [x] Replace stale foundation spec; add canonical PRD, field dictionary and prototype handoff notes.
- [x] Add pnpm scripts and explicit status/remaining-work documentation.

## Task 2: Domain logic (test first)

Files: packages/shared-types/src/index.ts; apps/api/src/modules/bilty/{domain,validation,money}.ts; apps/api/test/domain.test.ts.

- [x] Write behavioral tests for draft versus issue validation, repeatable references, monetary totals, snapshots, audit changes, cancellation and stale versions.
- [x] Run `pnpm test` and observe missing implementation failures.
- [x] Implement `createDraft`, `issueBilty`, `editBilty`, `cancelBilty`, `printData` and money helpers.
- [x] Run tests and typecheck; correct defects.

## Task 3: Persistence (test first)

Files: apps/api/src/database/{data-source,migrate}.ts; database/migrations/; modules/bilty/{bilty.service,bilty.module}.ts; test/postgres.test.ts.

- [x] Write real PostgreSQL tests: migration, round-trip, cross-company denial, revoked membership, same-tenant party references, concurrent number allocation, duplicate issue retry, stale edits, rollback and audit persistence.
- [x] Run tests against an isolated Docker Compose PostgreSQL container; observe the issuance failure, correct the TypeORM update result handling, and rerun successfully.
- [x] Implement scoped reads, row locking, atomic numbering and transactional audit writes; register service in NestJS module.
- [x] Run integration suite, build and typecheck.

## Task 4: Delivery

- [x] Review changes against PRD; update execution status and README.
- [x] Copy verified files with filesystem approval; sync the design folder PRD copy and add handoff notes.
- [x] Run checks from the destination repository and report scope/limitations.

## Verification evidence

Domain regression suite: 17 passed. PostgreSQL 16 Docker integration suite: 11 passed. Formatting, strict typecheck and build passed in the isolated workspace. Containerized migration runner built and applied one migration to the new Bilty development database. Verified again from the destination repository: formatting, strict typecheck, build, 17 domain tests and 11 Docker PostgreSQL tests passed. Canonical and design-reference PRD copies match. No commit or push was performed.
